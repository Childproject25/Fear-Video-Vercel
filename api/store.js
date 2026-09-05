import { Redis } from '@upstash/redis';

// يقرأ بيانات الاتصال من متغيرات البيئة التي تُضاف تلقائيًا عند ربط
// تكامل Redis (Upstash) بمشروعك على Vercel. ندعم الاسمين الشائعين للمتغيرات
// لتغطية طريقتي الإعداد المختلفتين (KV_REST_API_* أو UPSTASH_REDIS_REST_*).
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// مدة انتهاء صلاحية كل مفتاح تلقائيًا (بالثواني) — 6 ساعات، تكفي أي حصة
// دراسية وتُفرغ التخزين تلقائيًا دون الحاجة لتنظيف يدوي.
const TTL_SECONDS = 6 * 60 * 60;

// إضافة بادئة لعزل مفاتيح هذا التطبيق عن أي بيانات أخرى قد تُخزَّن على
// نفس قاعدة البيانات مستقبلًا.
const NAMESPACE = 'fearvideo:';

export default async function handler(req, res) {
  const key = req.query.key;
  if (!key || typeof key !== 'string' || key.length > 200) {
    return res.status(400).json({ error: 'invalid or missing "key" query parameter' });
  }
  const namespacedKey = NAMESPACE + key;

  try {
    if (req.method === 'GET') {
      // نقطة فحص بسيطة يستخدمها الواجهة الأمامية للتأكد من توفر الخدمة
      if (key === '__ping__') {
        return res.status(200).json({ key, value: 'ok' });
      }
      const value = await redis.get(namespacedKey);
      return res.status(200).json({ key, value: value === undefined ? null : value });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const value = typeof body.value === 'string' ? body.value : JSON.stringify(body.value ?? '');
      await redis.set(namespacedKey, value, { ex: TTL_SECONDS });
      return res.status(200).json({ key, value });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'storage backend error', detail: String(err) });
  }
}
