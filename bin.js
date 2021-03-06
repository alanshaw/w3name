#!/usr/bin/env node
import sade from 'sade'
import * as lib from './index.js'

const prog = sade('w3name')

prog.version('0.0.0')

prog
  .command('resolve <key>')
  .describe('Resolve the current CID for the given key ID.')
  .example('resolve k51qzi5uqu5dkgx70pep14x7b219nbb56zlrri5iglvetd7d4pqfvuvdetx8ts')
  .action(async key => {
    const result = await lib.resolve(key)
    if (!result) return console.error('not found')
    console.log(JSON.stringify(result, null, 2))
  })

prog
  .command('publish <key> <record>')
  .describe('Create or replace a name record for the given key ID. The IPNS record should be base64 encoded. The server validates the record and ensures it\'s sequence number is greater than the sequence number of any cached record.')
  .action(async (key, record) => {
    await lib.publish(key, record)
  })

prog
  .command('create-record <privateKey> <key> <value>')
  .describe('Create or update a name record for the given key ID to point to the given CID or IPFS path.')
  .action(async (privKey, key, value) => {
    const record = await lib.createRecord(privKey, key, value)
    console.log(JSON.stringify({ record }, null, 2))
  })

prog
  .command('create-keypair')
  .describe('Create a keypair for a new name, returns base64 encoded private key and derived key ID (for use when updating or resolving).')
  .action(async () => {
    const keys = await lib.createKeypair()
    console.log(JSON.stringify(keys, null, 2))
  })

prog.parse(process.argv)
