import { NextRequest } from "next/server";
import { POST } from "@/app/api/internal/cron/digest/route";

describe("digest cron route", () => {
  it("returns 401 when authorization is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/internal/cron/digest", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
