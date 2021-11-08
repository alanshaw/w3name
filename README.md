# w3name

Simple mutability for Web3.Storage.

## HTTP API

Users create a keypair<sup>*</sup> and derive a **Key ID** from the public key that acts as the "name".

The Key ID is the base36 "libp2p-key" encoding of the public key. The public key is protobuf encoded and contains `Type` and `Data` properties, see [`ed25519-class.js` for example](https://github.com/libp2p/js-libp2p-crypto/blob/c29c1490bbd25722437fdb36f2f0d1a705f35909/src/keys/ed25519-class.js#L25-L30).

Users "resolve" a Key ID to the current _value_ of a _record_. Typically a CID. Keypair owners "publish" name _records_ to create or update the current _value_.

* `GET /name/:key`
    **Resolve** the current CID for the given key ID. It returns the resolved value AND the full name record (for client side verification).
* 🔒 `POST /name/:key`
    **Publish** a name record for the given key ID. The updated record is signed with the private key and sent in the request body. The server validates the record and ensures the sequence number is greater than the sequence number of any cached record.

Additional routes _may_ be made available to allow trusted creation of public/private keys and trusted create/update of records:

* `POST /name/keypair`
    Create a keypair for a new name, returns base64 encoded private key and derived key ID (for use when updating or resolving).
* 🔒 `POST /name/record/:key/:cid`
    Create or update a name record for the given key ID to point to the given CID. The base64 encoded private key is sent in the request body.

Note: 🔒 denotes an authenticated route. These actually do not _need_ to be authenticated since users manage their own public/private keys but it'll allow us to block abuse and we may want to log/record information about which users are publishing updates in the future.

<sup>*</sup> Currently a Ed25519 2048 bit (min) key.

## More Information

This is a protocol for IPNS over HTTP. It is backed by IPNS records. In the future we _could_ publish these to the DHT for resolution via IPFS and we _could_ listen for updates from users publishing records to the DHT.

Caveats apply: Since IPNS distribution and resolution using the IPFS DHT is not yet performant, resolving records via the HTTP API will _not_ use the DHT and will return the "current" cached record (in Web3.Storage) for a given key. Likewise, publishing a record via the HTTP API will _not_ cause it to be published to the IPFS DHT i.e. records _must_ be created/updated via the HTTP API for up to date resolution via the HTTP API.

The important thing is that the name records in use here do not lock a user into dotStorage, they are just IPNS records that are byte for byte compatible with the IPNS records you'd publish via IPFS. They're also generated with the default IPFS keypair configuration and we use the same "Key ID" to address them. You can even use your IPFS private key from `~/.ipfs/config`. If we ever connect Web3.Storage to the IPNS publishing/distribution used in IPFS then you'd be able to publish name record updates via the Web3.Storage API or `ipfs name publish ...`.

## DB Schema

```sql
CREATE TABLE public.name (
    -- base36 "libp2p-key" encoding of the public key
    key         TEXT PRIMARY KEY,
    -- sequence number from the record (used to ensure updates are new)
    seqno       BIGINT NOT NULL DEFAULT 0,
    -- the IPNS record
    record      BYTEA NOT NULL,
    inserted_at TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP NOT NULL
)
```

## Websockets (future awesomeness)

In a future iteration we can use WebSockets and Cloudflare "Durable Objects" to allow users to "listen" to updates for a given key.

## Demo

This repo contains a CLI application, PoC code that can be easily adapted for an implementation in Web3.Storage.

```sh
npm i
npm link
```

1. `w3name create-keypair`
    Create a keypair and derive the "Key ID" from the public key. Alternatively use your local IPFS node. The "Key ID" can be found using `ipfs key list -l` and your private key can be found in `~/.ipfs/config` under `Identity.PrivKey`.
2. `w3name create-record <key> <cid> <privateKey>`
    Create a base64 encoded IPNS record. If an existing record is found, the new record will have the sequence number incremented. `key` is the "Key ID", `cid` is the CID to associate with the key and `privateKey` is used to create (sign) the record.
3. `w3name publish <key> <record>`
    Publish a name record. It _validates_ the record based on the public key found in the "Key ID". For the CLI demo this just saves the record to a `data.json` file under the given key. In production we'll also ensure the sequence number is greater than the sequence number of any existing record we have.
4. `w3name resolve <key>`
    Resolve the passed key to the current value. It returns the resolved value _and_ the record so that the signing information can be verified.
