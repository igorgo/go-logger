# go-logger
Daily logs writer

## Usage 
```
$ npm install --save 'igorgo/go-logger'
```

```js
const log = require('go-logger')
const logOptions = {
  fileTypes: ['slow', 'admin', 'access', 'server'],
  stdOut: ['server']
} 

...

await log.open(logOptions)

log.admin('Some important message')
// -> 2017-11-07 10:22:45.276	[6924]	Some important message 
log.error(new Error('An error occured!'))
// -> 2017-11-07 10:22:45.282	[6924]	Error: An error occured!; (\src\tst.js:20:11); Server.new ...

await log.close()

...
```
### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `fileTypes` | `Array` | `[]` | A list of the log types to create and handle. The `'error', 'debug', 'warning'` logs will be created and handled even if you do not specify them. | 
| `stdOut` | `Array` | `[]` | A list of the log types that will be output to the `stdout` as well as written to files. | 
| `dir` | `String` | `{process_dir}/log` | A path to write the log files |
| `pid` | `Boolean` | `true` | Includes the process id to each line of the log |
| `useLocalTime` | `Boolean` | `true` | If false then the UTC time will be use as timestamp for each line. |
| `bufferSizeKB` | `Number` | `64` | The size of the write buffer |
| `writeInterval` | `Number/String` | `3000` | The interval to write buffer to the file. Can be set by human readable string like `'1m 10s'` for 70000 milliseconds|    
| `keepDays` | `Number` | `3000` | The number of days after witch the log files should be deleted|
| `delEmpty` | `Boolean` | `false` | Whether or not to delete empty files when log is closed. Be aware, do not set it `true` for clustered or spawned subprocesses.|
