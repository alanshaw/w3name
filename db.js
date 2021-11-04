import fs from 'fs'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data.json')
/** @type {Record<string, any>} */
let data

async function load () {
  try {
    data = JSON.parse(await fs.promises.readFile(dbPath))
  } catch {
    data = {}
  }
}

async function save () {
  await fs.promises.writeFile(dbPath, JSON.stringify(data, null, 2))
}

/**
 * @param {string} key
 * @param {any} value
 */
export async function put (key, value) {
  if (!data) {
    await load()
  }
  data[key] = value
  await save()
}

/**
 * @param {string} key
 */
export async function get (key) {
  if (!data) {
    await load()
  }
  return data[key]
}
