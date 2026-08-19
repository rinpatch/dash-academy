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
};
