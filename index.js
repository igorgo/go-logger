'use strict'
const path = require('path')
const fs = require('fs')
const normalStack = require('go-normal-stack')
const stringifyObject = require('stringify-object')
const isObj = require('is-obj')
const concolor = require('concolor')
const _ = require('lodash')
const mkdirp = require('mkdirp')
const gDur = require('go-duration')

const tzoffset = (new Date()).getTimezoneOffset() * 60000
const localTime = () => (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1).replace('T', ' ')
const ISOTime = () => (new Date(Date.now())).toISOString()
const colorError = concolor('b,red')
const colorDebug = concolor('b,green')
const colorWarn = concolor('b,yellow')
const SEMICOLON_REGEXP = /;/g
const DAY_MILLISECONDS = gDur('1d')
function pad2 (aNumber) {
  return aNumber < 10 ? '0' + aNumber : '' + aNumber
}
function nowDate (aDate) {
  if (!aDate) aDate = new Date()
  return (
    aDate.getUTCFullYear() + '-' +
    pad2(aDate.getUTCMonth() + 1) + '-' +
    pad2(aDate.getUTCDate())
  )
}

class GoLogger {
  constructor () {
    this._active = false
    this._fileTypes = ['error', 'debug', 'warning']
    this._files = new Map()
    this._useLocalTime = true
    this._pid = true
    this._stdOut = []
    this._writeInterval = '3s'
    this._bufferSize = 64
    this._keepDays = 30
    this._delEmpty = false
    this._dir = path.join(process.cwd(), 'log')

    this._write = (aFileType, aMessage) => {
      const file = this._files.get(aFileType)
      if (!file) return
      if (aMessage instanceof Error) {
        aMessage = normalStack(aMessage)
      }
      else if (Array.isArray(aMessage) || isObj(aMessage)) {
        aMessage = stringifyObject(aMessage)
      }
      let msg = (this._useLocalTime ? localTime() : ISOTime())
      if (this._pid) msg += '\t[' + process.pid + ']'
      msg += '\t' + aMessage + '\n'
      file.buf += msg
      if (this._stdOut.includes(aFileType)) {
        msg = msg.substring(0, msg.length - 1)
        if (aFileType === 'debug') {
          msg = colorDebug(normalStack((new Error(msg)))).split(';')
          // _.remove(msg, (v) => v.startsWith(' Object.afs.log.'))
          msg[0] = msg[0].slice(16)
          // msg = msg.join('\n')
          msg = msg[0] + '\n' + msg[3]
        }
        else msg = msg.replace(SEMICOLON_REGEXP, '\n ')

        if (aFileType === 'error') msg = colorError(msg)
        else if (aFileType === 'debug') msg = colorDebug(msg)
        else if (aFileType === 'warning') msg = colorWarn(msg)
        msg = msg.replace(SEMICOLON_REGEXP, '\n ')
        console.log(msg)
      }
    }

    this._flush = fileType => new Promise(resolve => {
      const file = this._files.get(fileType)
      if (!file || file.lock || file.buf.length === 0) {
        resolve()
        return
      }
      file.lock = true
      const buf = file.buf
      file.buf = ''
      file.stream.write(buf, () => {
        file.lock = false
        resolve()
      })
    })

    this._closeFile = aFileType => new Promise(async resolve => {
      const file = this._files.get(aFileType)
      if (!file) {
        resolve()
        return
      }
      const filePath = file.stream.path
      await this._flush(aFileType)
      if (file.stream.closed) {
        resolve()
        return
      }
      file.stream.end(() => {
        clearInterval(file.timer)
        this._files.delete(aFileType)
        fs.stat(filePath, (e, stats) => {
          if (e || stats.size > 0) {
            resolve()
            return
          }
          if (this._delEmpty) {
            fs.unlink(filePath, resolve)
          }
          else {
            resolve()
          }
        })
      })
    })

    this._openFile = async (aFileType, aOnOpen, aOnError) => {
      const makeTimer = fileType => () => this._flush(fileType)
      const date = nowDate()
      const fileName = path.join(this._dir, date + '-' + aFileType + '.log')
      await this._closeFile(aFileType)
      const stream = fs.createWriteStream(fileName, {
        flags: 'a',
        highWaterMark: this._bufferSize
      })
      const timer = setInterval(
        makeTimer(aFileType),
        gDur(this._writeInterval)
      )
      /**
       * @property {WriteStream} stream
       * @property {String} buf
       * @property {Boolean} lock
       * @property timer
       */
      const file = { stream, buf: '', lock: false, timer }
      this._files.set(aFileType, file)
      if (aOnOpen) file.stream.on('open', aOnOpen)
      if (aOnError) file.stream.on('error', aOnError)
    }

    this._deleteOldFiles = () => {
      fs.readdir(this._dir, (e, fileList) => {
        const now = new Date()
        const date = new Date(
          now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0
        )
        const time = date.getTime()
        let i, fileTime, fileAge
        for (i in fileList) {
          fileTime = new Date(fileList[i].substring(0, 10)).getTime()
          fileAge = Math.floor((time - fileTime) / DAY_MILLISECONDS)
          if (fileAge > 1 && fileAge > this._keepDays) {
            fs.unlink(path.join(this._dir, fileList[i]), () => {})
          }
        }
      })
    }
  }

  get active () {
    return this._active
  }

  async open ({
                fileTypes = this._fileTypes,
                dir = this._dir,
                useLocalTime = this._useLocalTime,
                pid = this._pid,
                stdOut = this._stdOut,
                writeInterval = this._writeInterval,
                bufferSizeKB = this._bufferSize,
                keepDays = this._keepDays,
                delEmpty = this._delEmpty
              }) {

    this._fileTypes = fileTypes
    this._useLocalTime = useLocalTime
    this._pid = pid
    this._stdOut = ['error', 'debug', 'warning', ...stdOut]
    this._writeInterval = writeInterval
    this._bufferSize = bufferSizeKB * 1024
    this._keepDays = keepDays
    this._delEmpty = delEmpty
    if (!this._fileTypes.includes('error')) this._fileTypes.push('error')
    if (!this._fileTypes.includes('debug')) this._fileTypes.push('debug')
    if (!this._fileTypes.includes('warning')) this._fileTypes.push('warning')
    this._dir = dir
    this._fileTypes.forEach(fileType => {
      this[fileType] = message => {
        this._write(fileType, message)
      }
    })
    try {
      mkdirp.sync(this._dir)
    }
    catch (e) {
      console.error(e)
      return
    }
    const now = new Date()
    const nextDate = new Date()
    await Promise.all(_.map(
      this._fileTypes,
      async fileType => {
        await this._openFile(fileType)
      }
    ))
    this._active = true
    nextDate.setUTCHours(0, 0, 0, 0)
    const nextReopen = nextDate - now + DAY_MILLISECONDS
    setTimeout(this.open, nextReopen)
    this._deleteOldFiles()
  }

  async close () {
    if (!this._active) return
    this._active = false
    await Promise.all(_.map(
      this._fileTypes,
      async fileType => { await this._closeFile(fileType) }
    ))
  }
}

module.exports = new GoLogger()
