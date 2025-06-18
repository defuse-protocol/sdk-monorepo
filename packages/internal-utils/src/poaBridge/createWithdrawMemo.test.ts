import { describe, expect, it } from "vitest"
import { createWithdrawMemo } from "./createWithdrawMemo"

describe("createWithdrawMemo()", () => {
  it("assembles memo string", () => {
    expect(
      createWithdrawMemo({
        receiverAddress: "0xDEADBEEF",
      })
    ).toEqual("WITHDRAW_TO:0xDEADBEEF")

    expect(
      createWithdrawMemo({
        receiverAddress: "receiverAddress",
        xrpMemo: "xrpMemo",
      })
    ).toEqual("WITHDRAW_TO:receiverAddress:xrpMemo")

    expect(
      createWithdrawMemo({
        receiverAddress: "receiverAddress",
        xrpMemo: "",
      })
    ).toEqual("WITHDRAW_TO:receiverAddress")

    expect(
      createWithdrawMemo({
        receiverAddress: "receiverAddress",
        xrpMemo: null,
      })
    ).toEqual("WITHDRAW_TO:receiverAddress")
  })
})
