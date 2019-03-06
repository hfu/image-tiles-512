const config = require('config')
const mbgl = require('@mapbox/mapbox-gl-native')
const tilebelt = require('@mapbox/tilebelt')
const request = require('request')
const sharp = require('sharp')
const fs = require('fs')

const dstDir = config.get('dstDir')
const minzoom = config.get('minzoom')
const maxzoom = config.get('maxzoom')
const stylePath = config.get('stylePath')

const map = new mbgl.Map({
  request: (req, cb) => {
console.log(req.url)
    request({
      url: req.url, encoding: null, gzip: true, timeout: 2000
    }, (err, res, body) => {
      if (err) {
        cb(err)
      } else if (res.statusCode === 200) {
        let response = {}
        if (res.headers.modified) {
          response.modified = new Date(res.headers.modified)
        }
        if (res.headers.expires) {
          response.expires = new Date(res.headers.expires)
        }
        if (res.headers.etag) {
          response.etag = res.headers.etag
        }
        response.data = body
        cb(null, response)
      } else {
cb(null, { data: body })
//        cb(new Error(`${res.statusCode}: ${req.url}`))
      }
    })
  }
})

mbgl.on('message', msg => {
  console.log(msg)
})

map.load(JSON.parse(fs.readFileSync(stylePath)))

const render = (z, x, y) => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(`${dstDir}/${z}/${x}/${y}.png`)) {
      resolve(null)
    } else {
      const bbox = tilebelt.tileToBBOX([x, y, z])
      const center = [
        (bbox[0] + bbox[2]) / 2,
        (bbox[1] + bbox[3]) / 2
      ]
      map.render({ zoom: z, center: center }, (err, buffer) => {
        if (err) {
          reject(err)
        } else {
          // map.release()
          let image = sharp(buffer, {
            raw: { width: 512, height: 512, channels: 4 }
          })
          fs.mkdirSync(`${dstDir}/${z}/${x}`, { recursive: true })
          image.toFile(`${dstDir}/${z}/${x}/${y}.png`, err => {
            if (err) reject(err)
console.log('successful write')
            resolve(null)
          })
        }
      })
    }
  })
}

const main = async () => {
  for (let z = minzoom; z <= maxzoom; z++) {
    for (let x = 0; x < 2 ** z; x++) {
      for (let y = 0; y < 2 ** z; y++) {
        try {
          await render(z, x, y)
        } catch (e) {
          console.error(e)
        }
      }
    }
  }
}

main()
