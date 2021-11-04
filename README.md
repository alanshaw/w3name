# w3name

Simple mutability for Web3.Storage.

## HTTP API

Users create a Ed25519 2048 bit keypair and derive a **Key ID** from the public key that acts as the "name".

The Key ID is the base36 "libp2p-key" encoding of the public key. The public key is a protobuf encoding containing a type and the DER encoding of the PKCS SubjectPublicKeyInfo.

* `GET /name/:key`
    Resolve the current CID for the given key ID.
* 🔒 `POST /name/:key`
    Replace a name record for the given key ID. The updated record is signed with the private key and sent in the request body. The server validates the record and ensures it's sequence number is greater than the sequence number of any cached record.

Additional routes _may_ be made available to allow trusted creation of public/private keys and trusted create/update of records:

* `POST /name/keypair`
    Create a keypair for a new name, returns base64 encoded private key and derived key ID (for use when updating or resolving).
* 🔒 `POST /name/record/:key/:cid`
    Create or update a name record for the given key ID to point to the given CID. The base64 encoded private key is sent in the request body.

Note: 🔒 denotes an authenticated route. These actually do not _need_ to be authenticated since users manage their own public/private keys but it'll allow us to block abuse and we may want to log/record information about which users are publishing updates in the future.

## Information

This is a protocol for IPNS over HTTP. This is backed by IPNS records, in the future we _could_ publish these to the DHT for resolution via IPFS and we _could_ listen for updates from users publishing records to the DHT.

Since IPNS distribution and resolution is not yet performant, resolving records via the HTTP API will _not_ use the DHT and will return the "current" cached record for a given key. Likewise, publishing a record via the HTTP API will _not_ cause it to be published to the IPFS DHT i.e. records _must_ be created/updated via the HTTP API for up to date resolution via the HTTP API.

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
