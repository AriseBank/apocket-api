# apocket-api
aPocket API Backend Service for aPocket applications and CLIs.

# Description

aPocket's backend API service facilitates multisig HD wallets creation and operation through a simple and intuitive REST API.

APWS can usually be installed within minutes and accommodates all the needed infrastructure for peers in a multisig wallet to communicate and operate – with minimum server trust.

See [aPocket Library](https://github.com/arisebank/apocket-lib) for the *official* client library that communicates to APWS and verifies its response. Also check [aPocket-CLI](https://github.com/arisebank/bitcore-wallet) for a simple CLI wallet implementation that relies on APWS.

APWS is been used in production enviroments for [aPocket](https://arisebank.com/apocket), [aBank](https://arisebank.com/abank) and others.  

# Getting Started
```
 git clone https://github.com/arisebank/apocket-api.git
 cd apocket-api && npm start
```

This will launch the APWS service (with default settings) at `http://localhost:3232/apws/api`.

APWS needs mongoDB. You can configure the connection at `config.js`

APWS supports SSL and Clustering. For a detailed guide on installing APWS with extra features see [Installing APWS](https://github.com/arisebank/apocket-api/blob/master/installation.md).

APWS uses by default a Request Rate Limitation to CreateWallet endpoint. If you need to modify it, check defaults.js' `Defaults.RateLimit`

# Security Considerations
 * Private keys are never sent to APWS. Pocketeers store them locally.
 * Extended public keys are stored on APWS. This allows APWS to easily check wallet balance, send offline notifications to pocketeers, etc.
 * During wallet creation, the initial pocketeer creates a wallet secret that contains a private key. All pocketeers need to prove they have the secret by signing their information with this private key when joining the wallet. The secret should be shared using secured channels.
 * A pocketeer could join the wallet more than once, and there is no mechanism to prevent this. See [wallet](https://github.com/arisebank/bitcore-wallet)'s confirm command, for a method for confirming pocketeers.
 * All APWS responses are verified:
  * Addresses and change addresses are derived independently and locally by the pocketeers from their local data.
  * TX Proposals templates are signed by pocketeers and verified by others, so the APWS cannot create or tamper with them.

# REST API
## Authentication

  In order to access a wallet, clients are required to send the headers:
```
  x-identity
  x-signature
```
Identity is the Peer-ID, this will identify the peer and its wallet. Signature is the current request signature, using `requestSigningKey`, the `m/1/1` derivative of the Extended Private Key.

See [Bitcore Wallet Client](https://github.com/arisebank/apocket-lib/blob/master/lib/api.js#L73) for implementation details.


## GET Endpoints
`/v1/wallets/`: Get wallet information

Returns:
 * Wallet object. (see [fields on the source code](https://github.com/arisebank/apocket-api/blob/master/lib/model/wallet.js)).

`/v1/txhistory/`: Get Wallet's transaction history

Optional Arguments:
 * skip: Records to skip from the result (defaults to 0)
 * limit: Total number of records to return (return all available records if not specified).

Returns:
 * History of incoming and outgoing transactions of the wallet. The list is paginated using the `skip` & `limit` params. Each item has the following fields:
 * action ('sent', 'received', 'moved')
 * amount
 * fees
 * time
 * addressTo
 * confirmations
 * proposalId
 * creatorName
 * message
 * actions array ['createdOn', 'type', 'pocketeerId', 'pocketeerName', 'comment']


`/v1/txproposals/`:  Get Wallet's pending transaction proposals and their status
Returns:
 * List of pending TX Proposals. (see [fields on the source code](https://github.com/arisebank/apocket-api/blob/master/lib/model/txproposal.js))

`/v1/addresses/`: Get Wallet's main addresses (does not include change addresses)

Returns:
 * List of Addresses object: (https://github.com/arisebank/apocket-api/blob/master/lib/model/address.js)).  This call is mainly provided so the client check this addresses for incoming transactions (using a service like [Insight](https://insight.is)

`/v1/balance/`:  Get Wallet's balance

Returns:
 * totalAmount: Wallet's total balance
 * lockedAmount: Current balance of outstanding transaction proposals, that cannot be used on new transactions.
 * availableAmount: Funds available for new proposals.
 * totalConfirmedAmount: Same as totalAmount for confirmed UTXOs only.
 * lockedConfirmedAmount: Same as lockedAmount for confirmed UTXOs only.
 * availableConfirmedAmount: Same as availableAmount for confirmed UTXOs only.
 * byAddress array ['address', 'path', 'amount']: A list of addresses holding funds.
 * totalKbToSendMax: An estimation of the number of KiB required to include all available UTXOs in a tx (including unconfirmed).

`/v1/txnotes/:txid`:  Get user notes associated to the specified transaction.
Returns:
 * The note associated to the `txid` as a string.

`/v1/fiatrates/:code`:  Get the fiat rate for the specified ISO 4217 code.
Optional Arguments:
 * provider: An identifier representing the source of the rates.
 * ts: The timestamp for the fiat rate (defaults to now).

Returns:
 * The fiat exchange rate.

## POST Endpoints
`/v1/wallets/`: Create a new Wallet

 Required Arguments:
 * name: Name of the wallet
 * m: Number of required peers to sign transactions
 * n: Number of total peers on the wallet
 * pubKey: Wallet Creation Public key to check joining pocketeer's signatures (the private key is unknown by APWS and must be communicated
  by the creator peer to other peers).

Returns:
 * walletId: Id of the new created wallet


`/v1/wallets/:id/pocketeers/`: Join a Wallet in creation

Required Arguments:
 * walletId: Id of the wallet to join
 * name: Pocketeer Name
 * xPubKey - Extended Public Key for this pocketeer.
 * requestPubKey - Public Key used to check requests from this pocketeer.
 * pocketeerSignature - Signature used by other pocketeers to verify that the pocketeer joining knows the wallet secret.

Returns:
 * pocketeerId: Assigned ID of the pocketeer (to be used on x-identity header)
 * wallet: Object with wallet's information

`/v1/txproposals/`: Add a new transaction proposal

Required Arguments:
 * toAddress: RCPT Bitcoin address.
 * amount: amount (in satoshis) of the mount proposed to be transfered
 * proposalsSignature: Signature of the proposal by the creator peer, using proposalSigningKey.
 * (opt) message: Encrypted private message to peers.
 * (opt) payProUrl: Paypro URL for peers to verify TX
 * (opt) feePerKb: Use an alternative fee per KB for this TX.
 * (opt) excludeUnconfirmedUtxos: Do not use UTXOs of unconfirmed transactions as inputs for this TX.

Returns:
 * TX Proposal object. (see [fields on the source code](https://github.com/arisebank/apocket-api/blob/master/lib/model/txproposal.js)). `.id` is probably needed in this case.


`/v1/addresses/`: Request a new main address from wallet

Returns:
 * Address object: (https://github.com/arisebank/apocket-api/blob/master/lib/model/address.js)). Note that `path` is returned so client can derive the address independently and check server's response.

`/v1/txproposals/:id/signatures/`: Sign a transaction proposal

Required Arguments:
 * signatures:  All Transaction's input signatures, in order of appearance.

Returns:
 * TX Proposal object. (see [fields on the source code](https://github.com/arisebank/apocket-api/blob/master/lib/model/txproposal.js)). `.status` is probably needed in this case.

`/v1/txproposals/:id/broadcast/`: Broadcast a transaction proposal

Returns:
 * TX Proposal object. (see [fields on the source code](https://github.com/arisebank/apocket-api/blob/master/lib/model/txproposal.js)). `.status` is probably needed in this case.

`/v1/txproposals/:id/rejections`: Reject a transaction proposal

Returns:
 * TX Proposal object. (see [fields on the source code](https://github.com/arisebank/apocket-api/blob/master/lib/model/txproposal.js)). `.status` is probably needed in this case.

`/v1/addresses/scan`: Start an address scan process looking for activity.

 Optional Arguments:
 * includePocketeerBranches: Scan all pocketeer branches following BIP45 recommendation (defaults to false).

`/v1/txconfirmations/`: Subscribe to receive push notifications when the specified transaction gets confirmed.
Required Arguments:
 * txid:  The transaction to subscribe to.

## PUT Endpoints
`/v1/txnotes/:txid/`: Modify a note for a tx.


## DELETE Endpoints
`/v1/txproposals/:id/`: Deletes a transaction proposal. Only the creator can delete a TX Proposal, and only if it has no other signatures or rejections

 Returns:
 * TX Proposal object. (see [fields on the source code](https://github.com/arisebank/apocket-api/blob/master/lib/model/txproposal.js)). `.id` is probably needed in this case.

`/v1/txconfirmations/:txid`: Unsubscribe from transaction `txid` and no longer listen to its confirmation.


# Push Notifications
  Recomended to complete config.js file:

  * [GCM documentation to get your API key](https://developers.google.com/cloud-messaging/gcm)
  * [Apple's Notification guide to know how to get your certificates for APN](https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/Introduction.html)


## POST Endpoints
`/v1/pushnotifications/subscriptions/`: Adds subscriptions for push notifications service at database.


## DELETE Endopints
`/v2/pushnotifications/subscriptions/`: Remove subscriptions for push notifications service from database.
