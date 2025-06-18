export function createWithdrawMemo({
  receiverAddress,
  xrpMemo,
}: {
  receiverAddress: string
  xrpMemo?: string | null
}) {
  const memo = ["WITHDRAW_TO", receiverAddress]

  if (xrpMemo != null && xrpMemo !== "") {
    memo.push(xrpMemo)
  }

  return memo.join(":")
}
