import { describe, expect, it } from "vitest";
import { Outlayer } from "./outlayer";

describe("Outlayer", () => {
    describe("send()", () => {
        it("Should get the signed transaction", async () => {
            const seed = 'f909b4aa7bdcb86e5d087f64ac3c448b29faf79009861fe8fbfde5a2ddf03653ed93f9ef27f7b74780aa48f042e44c0f7e29be6e043522abe684ef0112ae2c77';
            const outlayer = new Outlayer(seed);
            const  message = {message: "0x000000000100000000" };

            const result = await outlayer.send(JSON.stringify(message));

            expect(result).toEqual('');
        })
    })
})