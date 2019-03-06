const config = require('config')
const mbgl = require('@mapbox/mapbox-gl-native')
const request = require('request')
const sharp = require('sharp')
const fs = require('fs')
const vtpbf = require('vt-pbf')

const emptyTile = vtpbf({ features: [] })

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
cb(null, { data: emptyTile })
//        cb(err)
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
cb(null, { data: emptyTile })
//        cb(new Error(`${res.statusCode}: ${req.url}`))
      }
    })
  }
})

mbgl.on('message', msg => {
  console.log(msg)
})

map.load(JSON.parse(fs.readFileSync(stylePath)))

const tile2long = (x, z) => {
  return x / 2 ** z * 360 - 180
}

const tile2lat = (y, z) => {
  const n = Math.PI - 2 * Math.PI * y / 2 ** z
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

const render = (z, x, y) => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(`${dstDir}/${z}/${x}/${y}.png`)) {
      console.log(`skip ${z}/${x}/${y}`)
      resolve(null)
    } else {
      const center = [ tile2long(x + 0.5, z), tile2lat(y + 0.5, z) ]
      map.render({
        zoom: z, center: center, 
        width: z > 2 ? 1024 : 512,
        height: z > 2 ? 1024 : 512
      }, (err, buffer) => {
        if (err) {
          reject(err)
        } else {
          // map.release()
          let image = sharp(buffer, {
            raw: {
              width: z > 2 ? 1024 : 512,
              height: z > 2 ? 1024 : 512,
              channels: 4
            }
          })
          fs.mkdirSync(`${dstDir}/${z}/${x}`, { recursive: true })
          if (z > 2) {
            image = image.extract({
              left: 256, top: 256, width: 512, height: 512
            })
          }
          image.toFile(`${dstDir}/${z}/${x}/${y}.png`, err => {
            if (err) reject(err)
console.log(`${z}/${x}/${y}: successful write`)
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
