import { createServerFn } from "@tanstack/react-start";

export const draftFollowUp = createServerFn({ method: "POST" })
  .validator((input: { customer: string; context: string; tone: string }) => {
    const customer = input?.customer?.trim().slice(0, 120) ?? "";
    const context = input?.context?.trim().slice(0, 700) ?? "";
    const tone = input?.tone?.trim().slice(0, 40) || "محترمانه و کوتاه";
    if (customer.length < 2) throw new Error("نام مشتری لازم است");
    return { customer, context, tone };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "دستیار در این محیط در دسترس نیست. متن را خودتان بنویسید." };
    }
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 320,
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content:
                "تو دستیار نگارش رشدیار هستی. فقط پیش‌نویس پیام پیگیری فارسی می‌نویسی. قیمت، تخفیف، وعده مالی یا تعهد قراردادی نساز. دو نسخه کوتاه بده: پیامک و یادداشت مودبانه. حداکثر ۱۲۰ کلمه.",
            },
            { role: "user", content: `مشتری: ${data.customer}\nلحن: ${data.tone}\nزمینه:\n${data.context}` },
          ],
        }),
      });
      if (!res.ok) return { ok: false as const, error: "پاسخ دستیار دریافت نشد." };
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) return { ok: false as const, error: "پاسخ خالی بود." };
      return { ok: true as const, text };
    } catch {
      return { ok: false as const, error: "ارتباط با دستیار برقرار نشد." };
    }
  });
