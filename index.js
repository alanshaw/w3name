/* eslint-env browser */
import * as uint8arrays from 'uint8arrays'
import * as ipns from 'ipns'
import * as Digest from 'multiformats/hashes/digest'
import { identity } from 'multiformats/hashes/identity'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import { keys } from 'libp2p-crypto'
import * as db from './db.js'

const libp2pKeyCode = 0x72

/**
 * @param {string} key "libp2p-key" encoding of the public key.
 * @param {string} record base64 encoded buffer of IPNS record to publish.
 */
export async function publish (key, record) {
  const keyCid = CID.parse(key, base36)
  if (keyCid.code !== libp2pKeyCode) {
    throw new Error(`invalid key code: ${keyCid.code}`)
  }

  const entry = ipns.unmarshal(uint8arrays.fromString(record, 'base64pad'))
  const pubKey = keys.unmarshalPublicKey(Digest.decode(keyCid.multihash.bytes).bytes)

  if (entry.pubKey && !keys.unmarshalPublicKey(entry.pubKey).equals(pubKey)) {
    throw new Error('embedded public key mismatch')
  }

  await ipns.validate(pubKey, entry)

  // Update the DB, ensuring the seqno in the update is greater than the current
  const existingRecord = await db.get(key)
  const existingEntry = existingRecord ? ipns.unmarshal(uint8arrays.fromString(existingRecord, 'base64pad')) : null

  if (existingEntry && existingEntry.seqNumber <= entry.seqNumber) {
    throw new Error('invalid sequence number')
  }

  await db.put(key, record)
}

/**
 * @param {string} key "libp2p-key" encoding of the public key.
 */
export async function resolve (key) {
  const { code } = CID.parse(key, base36)
  if (code !== libp2pKeyCode) {
    throw new Error(`invalid key code: ${code}`)
  }

  const record = await db.get(key)
  if (!record) return // not has

  const entry = ipns.unmarshal(uint8arrays.fromString(record, 'base64pad'))

  // TODO: ensure not expired?

  return { value: uint8arrays.toString(entry.value), record }
}

export async function createKeypair () {
  const privKey = await keys.generateKeyPair('Ed25519', 2048)
  const digest = Digest.create(identity.code, privKey.public.bytes)

  return {
    id: CID.createV1(libp2pKeyCode, digest).toString(base36),
    privateKey: uint8arrays.toString(privKey.bytes, 'base64pad')
  }
}

/**
 * @param {string} privKey base64 encoded private key
 * @param {string} key "libp2p-key" encoding of the public key.
 * @param {string} value IPFS path
 */
export async function createRecord (privKey, key, value) {
  const { code } = CID.parse(key, base36)
  if (code !== libp2pKeyCode) {
    throw new Error(`invalid key code: ${code}`)
  }

  const privKeyBytes = uint8arrays.fromString(privKey, 'base64pad')
  const privKeyObj = await keys.unmarshalPrivateKey(privKeyBytes)
  const lifetime = 1000 * 60 * 60 // TODO: how long?

  const record = await db.get(key)
  let entry = record ? ipns.unmarshal(uint8arrays.fromString(record, 'base64pad')) : null

  // Determine the record sequence number
  let seqNumber = 0n
  if (entry && entry.sequence !== undefined) {
    seqNumber = uint8arrays.equals(entry.value, value) ? entry.sequence : entry.sequence + 1n
  }

  entry = await ipns.create(privKeyObj, uint8arrays.fromString(value), seqNumber, lifetime)
  return uint8arrays.toString(ipns.marshal(entry), 'base64pad')
}

// main()
