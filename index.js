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
    request({
      url: req.url, encoding: null, gzip: true
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
        cb(new Error(res.statusCode))
      }
    })
  }
})

map.load(JSON.parse(fs.readFileSync(stylePath)))

const render = (z, x, y) => {
  const bbox = tilebelt.tileToBBOX([x, y, z])
  const center = [
    (bbox[0] + bbox[2]) / 2,
    (bbox[1] + bbox[3]) / 2
  ]
  map.render({ zoom: z, center: center }, (err, buffer) => {
    if (err) {
      console.error(err)
    } else {
      let image = sharp(buffer, {
        raw: { width: 512, height: 512, channels: 4 }
      })
      image.png().toBuffer().then(result => {
        fs.mkdirSync(`${dstDir}/${z}/${x}`, { recursive: true })
        fs.writeFileSync(`${dstDir}/${z}/${x}/${y}.png`, result)
        console.log(`wrote ${dstDir}/${z}/${x}/${y}.png`)
      })
    }
  })
}

render(0, 0, 0)
/**
for (let z = minzoom; z <= maxzoom; z++) {
  for (let x = 0
**/
