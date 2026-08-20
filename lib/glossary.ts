export type GlossaryEntry = {
  /** Heading shown in the popover. Usually the term in its canonical singular form. */
  title: string;
  /** One or two plain-language sentences. Assume a developer who has not used a blockchain. */
  definition: string;
  /** Optional grouping chip, e.g. "Basics", "Dash", "Protocol". */
  tag?: string;
  /** Optional lesson or doc that covers the term properly. */
  href?: string;
};

/**
 * Terms a lesson may mark with <Term> instead of defining inline. Add an entry here rather than
 * padding a lesson with a definition that readers who already know the term have to skim past.
 */
export const GLOSSARY: Record<string, GlossaryEntry> = {
  block: {
    title: "Block",
    definition:
      "A batch of transactions the network has agreed on, chained to the block before it. Appending a block is how a blockchain moves forward; rewriting one means redoing every block after it.",
    tag: "Basics",
  },
  transaction: {
    title: "Transaction",
    definition:
      "A signed instruction to move value or change state. Once it is in a block the whole network has the same copy, and nobody can quietly edit it afterwards.",
    tag: "Basics",
  },
  "private-key": {
    title: "Private key",
    definition:
      "The secret number that authorises spending or signing. Whoever holds it controls the funds — there is no password reset, and no support desk that can restore it.",
    tag: "Basics",
  },
  "seed-phrase": {
    title: "Seed phrase",
    definition:
      "A list of words, usually twelve or twenty-four, that every key in a wallet is derived from. Back it up offline: it is the wallet, and anyone who reads it owns the funds.",
    tag: "Basics",
  },
  address: {
    title: "Address",
    definition:
      "A short string derived from a public key that others can pay. Publishing it is safe; it reveals nothing about the private key behind it.",
    tag: "Basics",
  },
  finality: {
    title: "Finality",
    definition:
      "The point at which a payment can no longer be reversed. On many chains it means waiting for several blocks; on Dash, InstantSend gets there in about a second.",
    tag: "Dash",
  },
  faucet: {
    title: "Faucet",
    definition:
      "A free dispenser of testnet coins. Testnet coins are worth nothing, which is exactly why you can practise with them.",
    tag: "Basics",
  },
  "smart-contract": {
    title: "Smart contract",
    definition:
      "Code deployed to a blockchain that runs when someone calls it. Dash Platform takes a different approach: you describe your data with a schema and the network stores and validates it, so there is no contract code of your own to run.",
    tag: "Basics",
  },
  ico: {
    title: "ICO",
    definition:
      "Initial coin offering: a fundraising event where a project sells its own new coin before the network is running. Dash did not hold one.",
    tag: "Basics",
  },
  premine: {
    title: "Premine",
    definition:
      "Coins created and kept by a project's founders before the network opens to everyone else. Dash launched without one.",
    tag: "Basics",
  },
  grpc: {
    title: "gRPC",
    definition:
      "A protocol for calling functions on a remote server, using a compact binary format instead of JSON. You use it through a generated client, much like calling a normal function.",
    tag: "Protocol",
  },
  "json-rpc": {
    title: "JSON-RPC",
    definition:
      "A simple convention for calling a method on a server by posting JSON describing the method name and its arguments.",
    tag: "Protocol",
  },
  fiat: {
    title: "Fiat currency",
    definition: "Government-issued money such as the dollar or euro, as opposed to a cryptocurrency.",
    tag: "Basics",
  },
  masternode: {
    title: "Masternode",
    definition:
      "A Dash server that does more than relay transactions: it provides the network's extra services and is required to hold Dash as collateral, which is what makes it costly to misbehave.",
    tag: "Dash",
  },
  dapp: {
    title: "dApp",
    definition:
      "Decentralized application: an app whose data and rules live on a blockchain network rather than on a server one company controls.",
    tag: "Basics",
  },
  testnet: {
    title: "Testnet",
    definition:
      "A parallel copy of the network that runs on worthless coins, so you can practice real operations without risking real money.",
    tag: "Basics",
  },
  identity: {
    title: "Identity",
    definition:
      "A persistent account on Dash Platform with a stable ID, public keys, and a credit balance. It owns application data and authorizes the signed changes to it.",
    tag: "Dash",
  },
  "state-transition": {
    title: "State transition",
    definition:
      "A signed operation that changes Dash Platform state, such as creating an identity, registering a name, or writing a document.",
    tag: "Dash",
  },
  bech32m: {
    title: "Bech32m",
    definition:
      "A checksummed address encoding derived from bech32. Dash uses it for Platform addresses, which start with tdash1 on testnet.",
    tag: "Dash",
  },
  mnemonic: {
    title: "Mnemonic",
    definition:
      "A short list of ordinary words a wallet uses to derive every key and address it controls. Anyone who knows it can spend everything it derives, so it must stay private.",
    tag: "Basics",
  },
  dpns: {
    title: "DPNS",
    definition:
      "The Dash Platform Name Service: a Platform contract that registers human-readable .dash names tied to an identity.",
    tag: "Dash",
  },
  dapi: {
    title: "DAPI",
    definition:
      "Dash's decentralized API. Apps and SDKs read and write Platform and Core data through it instead of running their own node.",
    tag: "Dash",
  },
  duff: {
    title: "Duff",
    definition:
      "Dash's smallest unit: one hundred-millionth of a Dash. Platform credits convert at a fixed rate of 1,000 credits per duff.",
    tag: "Dash",
  },
  grovedb: {
    title: "GroveDB",
    definition:
      "Dash Platform's document-oriented storage engine. Each contract's documents live in a collection addressed by contract and document type, with no relational joins between them.",
    tag: "Dash",
  },
  "data-contract": {
    title: "Data contract",
    definition:
      "A published schema that declares the document types an application may store, with their fields, types, and indexes. Every document write is validated against it.",
    tag: "Dash",
  },
  evonode: {
    title: "Evonode",
    definition:
      "A masternode that also runs Dash Platform, so beyond Core's extra services it serves the decentralized API (DAPI) and stores Platform state.",
    tag: "Dash",
  },
  "grove-db": {
    title: "GroveDB",
    definition:
      "Dash Platform's storage engine. It keeps application state in an authenticated tree so that a single root hash can represent the whole state and let clients verify specific data against it.",
    tag: "Dash",
  },
  apphash: {
    title: "AppHash",
    definition:
      "The root hash of Dash Platform's application state, committed in each block header. It is the anchor a state proof is checked against.",
    tag: "Protocol",
  },
  llmq: {
    title: "Long-Living Masternode Quorum",
    definition:
      "A long-lived group of masternodes that jointly sign committed results with a threshold signature, so no single member can produce a valid one alone.",
    tag: "Dash",
  },
  tls: {
    title: "TLS",
    definition:
      "Transport Layer Security: the protocol that encrypts a connection so it cannot be read or tampered with in transit. It protects the pipe, not the truth of the data inside it.",
    tag: "Protocol",
  },
  node: {
    title: "Node",
    definition:
      "A computer running the Dash software that takes part in the network: it keeps a copy of the chain, relays transactions, and checks each new block against the rules.",
    tag: "Basics",
  },
  mining: {
    title: "Mining",
    definition:
      "The work of proposing new blocks to the network. Miners compete to assemble the next block of transactions and are paid in newly issued coins for the block the network accepts.",
    tag: "Basics",
  },
  "state-proof": {
    title: "State proof",
    definition:
      "A cryptographic proof a Platform query can return alongside its data, proving the response matches committed state. A client checks it against the block's AppHash instead of trusting the node that answered.",
    tag: "Protocol",
  },
  "light-client": {
    title: "Light client",
    definition:
      "A client that verifies data against cryptographic proofs and block headers instead of downloading or re-running the whole chain itself.",
    tag: "Dash",
  },
};
