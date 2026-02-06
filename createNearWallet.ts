import { Account, KeyPair, connect, keyStores } from "near-api-js"

export default async function createAccountFromPrivateKey(privateKey, accountId, networkId): Promise<Account> {
  // 1. Setup key store
  const keyStore = new keyStores.InMemoryKeyStore()

  // 2. Create KeyPair from private key
  const keyPair = KeyPair.fromString(privateKey)

  // 3. Add key to keyStore
  await keyStore.setKey(networkId, accountId, keyPair)

  // 4. Initialize connection to NEAR
  const near = await connect({
    networkId,
    keyStore,
    nodeUrl: `https://rpc.${networkId}.near.org`,
    walletUrl: `https://wallet.${networkId}.near.org`,
    helperUrl: `https://helper.${networkId}.near.org`,
    headers: {}
  })

  // 5. Create account instance
  const account = new Account(near.connection, accountId)

  // ✅ Now you can use `account` to interact with NEAR
  console.log(`Account loaded: ${accountId}`)
  console.log(await account.getAccountBalance())
  return account
}
