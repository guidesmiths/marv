var XRegExp = require('xregexp')
var directivePattern = XRegExp('^--\\s*@MARV\\s+(?<key>\\w+)\\s*=\\s*(?<value>\\S+)', 'mig')

module.exports = function parseDirectives(script) {
    var directives = {}
    XRegExp.forEach(script, directivePattern, function(match) {
        directives[match[1].toLowerCase()] = match[2]
    })
    return directives
}
