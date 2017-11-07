# go-logger
Daily logs writer

##Usage 
```
$ npm install --save 'igorgo/go-logger'
```

```js
const Logger = require('go-logger')

module.exports = new Logger({
  fileTypes: ['slow', 'admin', 'access', 'server'],
  stdOut: ['server']
})

```
