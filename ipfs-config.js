import fs from 'fs'
import os from 'os'
import path from 'path'
import { keys } from 'libp2p-crypto'
import * as uint8arrays from 'uint8arrays'

export async function getPrivKey () {
  try {
    const ipfsConfigPath = path.join(os.homedir(), '.ipfs', 'config')
    const config = JSON.parse(await fs.promises.readFile(ipfsConfigPath))
    const privKeyBytes = uint8arrays.fromString(config.Identity.PrivKey, 'base64pad')
    return keys.unmarshalPrivateKey(privKeyBytes)
  } catch (err) {
    return keys.generateKeyPair('Ed25519', 2048)
  }
}
