#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const axios = require('axios')
const clipboardy = require('clipboardy')
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

// Config folder: icons-cli
const userPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share')
if (!fs.existsSync(path.resolve(userPath, './icons-cli/'))) fs.mkdirSync(path.resolve(userPath, './icons-cli/'))

// Local DB
const adapter = new FileSync(path.resolve(userPath, './icons-cli/db.json'))
const db = low(adapter)
db.defaults({ icons: [], previous: [], next: [] }).write()

const HISTORY_SIZE = 50
const ICON_ID = /(?:icons8\.com\/icon\/)(\w+)/

const url = (id) => `https://api-icons.icons8.com/siteApi/icons/icon?id=${id}`
const getSVG = (base64) => Buffer.from(base64, 'base64').toString('ascii')

function getIcon(id) {
  return axios({
    method: 'get',
    url: url(id),
  })
    .then(({ data }) => data)
    .then(({ status, icon }) => icon)
}

async function getSVGIconFromHTML(html = '') {
  const match = html.match(ICON_ID)
  const id = match[1]
  if (!id) {
    console.error("Couldn't find the id.")
    return
  } else {
    let icon = {}
    const cached = db.get('icons').find({ id }).value()
    if (cached) {
      icon = cached
    } else {
      try {
        icon = await getIcon(id)
        db.get('icons').push(icon).write()

        for (let variant of icon.variants || []) {
          db.get('icons').push(variant).write()
        }
      } catch (error) {
        console.error(`We couldn't retrieve the icon (id: ${id}). Damn. Sorry about that.`)
        icon = null
      }
    }
    if (icon && icon.id) {
      db.get('previous').push(icon.id)
      db.set('previous', db.get('previous').value().slice(-HISTORY_SIZE)).write()
    }
    return { icon, cache: !!cached }
  }
}

async function run() {
  const commands = process.argv.slice(2)
  const [command, ...inputs] = commands
  const clipboard = clipboardy.readSync()

  if (!clipboardy || (typeof clipboard === 'string' && !clipboard.startsWith('<a'))) {
    console.error("The copied icons8 link isn't valid.")
    // } else if (command) {
    // switch (command) {
    //   case 'prev':
    //     break

    //   default:
    //     break
    // }
  } else if (clipboard) {
    const { icon, cache } = await getSVGIconFromHTML(clipboard)
    if (icon) {
      clipboardy.writeSync(getSVG(icon.svg))
      console.log(`${icon.name} (${icon.platform}) SVG has been copied to the clipboard! ${cache ? '(cache)' : '(now cached)'}`)
    }
  }
}

run()
