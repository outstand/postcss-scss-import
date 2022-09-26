const path = require('path');
const resolve = require("resolve")
const postcssImport = require('postcss-import')

const moduleDirectories = ["web_modules", "node_modules"]

function resolveModule(id, opts) {
  return new Promise((res, rej) => {
    resolve(id, opts, (err, path) => (err ? rej(err) : res(path)))
  })
}

const logLevel = {
	none: 0,
	fail: 1,
	match: 2,
	all: 3,
}

function resolver(id, base, options) {
  const paths = options.path

  const resolveOpts = {
    basedir: base,
    moduleDirectory: moduleDirectories.concat(options.addModulesDirectories),
    paths,
    extensions: [".css", ".scss"],
    packageFilter: function processPackage(pkg) {
      if (pkg.style) pkg.main = pkg.style
      else if (!pkg.main || !/\.css$/.test(pkg.main)) pkg.main = "index.css"
      return pkg
    },
    preserveSymlinks: false,
  }

  const underscoreId = path.join(path.dirname(id), `_${path.basename(id)}`)
  // console['log'](`[Import Resolver] ${id}:`, "underscore", underscoreId)

  return resolveModule(`./${id}`, resolveOpts)
    .catch(() => resolveModule(`./${underscoreId}`, resolveOpts))
    .catch(() => resolveModule(id, resolveOpts))
    .catch(() => {
      if (paths.indexOf(base) === -1) paths.unshift(base)

      throw new Error(
        `Failed to find '${id}'
  in [
    ${paths.join(",\n        ")}
  ]`
      )
    })
}

function aliasResolver(config = {}) {
  let {
    alias,
    logging,
  } = config

  alias = alias || {}
  logging = logging || "none"

  logging = typeof logging === 'string'
    ? logLevel[logging]
    : typeof logging === 'number'
    ? logging
    : logLevel.fail

  let log = {}
  Object.keys(logLevel).forEach(level => {
    log[level] = (logging >= logLevel[level])
      ? (id, ...args) => console[level==='fail'?'warn':'log'](`[Import Resolver] ${id}:`, ...args)
      : () => {}
  })

  return function resolve(id, base, options) {
    log.all(id)

    for (let [aliasName, aliasPath] of Object.entries(alias)) {
      log.all(id, "looking in aliases", aliasName)
      if (id.startsWith(aliasName + path.sep)) {
        log.match(id, "matched alias", aliasName, aliasPath)

        let aliasedId = path.join(aliasPath, id.substring(aliasName.length))
        return resolver(aliasedId, base, options)
      }
    }

    return resolver(id, base, options)
  }
}

/**
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
  opts = Object.assign({
    prefix: true
  }, opts)

  opts.resolve = aliasResolver(opts)

  return {
    postcssPlugin: 'postcss-scss-import',
    Once(root, options) {
      return postcssImport(opts).Once(root, options)
    }
  }
}

module.exports.postcss = true
