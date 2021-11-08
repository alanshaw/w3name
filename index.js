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
 * @param {string} rawKey "libp2p-key" encoding of the public key.
 * @param {string} rawRecord base64 encoded buffer of IPNS record to publish.
 */
export async function publish (rawKey, rawRecord) {
  const key = CID.parse(rawKey, base36)
  if (key.code !== libp2pKeyCode) {
    throw new Error(`invalid key code: ${key.code}`)
  }

  const record = ipns.unmarshal(uint8arrays.fromString(rawRecord, 'base64pad'))
  const pubKey = keys.unmarshalPublicKey(Digest.decode(key.multihash.bytes).bytes)

  if (record.pubKey && !keys.unmarshalPublicKey(record.pubKey).equals(pubKey)) {
    throw new Error('embedded public key mismatch')
  }

  await ipns.validate(pubKey, record)

  // Update the DB, ensuring the seqno in the update is greater than the current
  const existingRawRecord = await getRecord()
  const existingRecord = existingRawRecord ? ipns.unmarshal(rawRecord) : null

  if (existingRecord && existingRecord.seqNumber <= record.seqNumber) {
    throw new Error('invalid sequence number')
  }

  await db.put(rawKey, rawRecord)
}

async function getRecord (key) {
  const value = await db.get(key)
  return value ? uint8arrays.fromString(value, 'base64pad') : undefined
}

/**
 * @param {string} rawKey "libp2p-key" encoding of the public key.
 */
export async function resolve (rawKey) {
  const key = CID.parse(rawKey, base36)
  if (key.code !== libp2pKeyCode) {
    throw new Error(`invalid key code: ${key.code}`)
  }

  const rawRecord = await getRecord(rawKey)
  if (!rawRecord) return // not has

  const record = ipns.unmarshal(rawRecord)

  // TODO: ensure not expired?

  return {
    value: CID.decode(record.value).toString(),
    record: uint8arrays.toString(rawRecord, 'base64pad')
  }
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
 * @param {string} rawKey
 * @param {string} rawCid
 * @param {string} rawPrivKey base64 encoded private key
 */
export async function createRecord (rawKey, rawCid, rawPrivKey) {
  const key = CID.parse(rawKey, base36)
  if (key.code !== libp2pKeyCode) {
    throw new Error(`invalid key code: ${key.code}`)
  }

  const privKeyBytes = uint8arrays.fromString(rawPrivKey, 'base64pad')
  const privKey = await keys.unmarshalPrivateKey(privKeyBytes)

  const cid = CID.parse(rawCid)
  const value = cid.bytes
  const lifetime = 1000 * 60 * 60 // TODO: how long?

  const rawRecord = await getRecord(rawKey)
  let record = rawRecord ? ipns.unmarshal(rawRecord) : null

  // Determine the record sequence number
  let seqNumber = 0n
  if (record && record.sequence !== undefined) {
    seqNumber = uint8arrays.equals(record.value, value) ? record.sequence : record.sequence + 1n
  }

  record = await ipns.create(privKey, value, seqNumber, lifetime)
  return uint8arrays.toString(ipns.marshal(record), 'base64pad')
}

// main()
