import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";

export type HomeFeature = {
  id: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  /** Where this card navigates. Omitted while a feature's screen doesn't exist yet. */
  route?: Href;
};

// Order matches the spec exactly — this is the single source of truth the
// Home screen maps over to render the 7 feature cards.
export const HOME_FEATURES: HomeFeature[] = [
  {
    id: "scan-summarize",
    icon: "scan-outline",
    title: "تصوير المستندات وتلخيصها",
    subtitle: "صوّر أي مستند واسمع أهم المعلومات فيه — المبلغ والموعد والخطوة التالية",
    route: "/scan",
  },
  {
    id: "voice-forms",
    icon: "mic-outline",
    title: "المساعد الصوتي وملء الاستمارات",
    subtitle: "اسأل بصوتك أو املأ أي استمارة بالكلام بدون كتابة",
  },
  {
    id: "read-simplify",
    icon: "volume-high-outline",
    title: "قراءة المستندات وتبسيط لغتها",
    subtitle: "يقرأ لك المستند بصوت عربي واضح ويحوّل اللغة الرسمية إلى كلام بسيط",
  },
  {
    id: "archive-alerts",
    icon: "archive-outline",
    title: "أرشيف مستنداتك وتنبيهات انتهاء الصلاحية",
    subtitle: "كل مستنداتك محفوظة — ابحث عنها بصوتك، ونذكّرك قبل انتهاء صلاحية أي مستند",
  },
  {
    id: "office-guidance",
    icon: "compass-outline",
    title: "إرشادك داخل المصالح الحكومية",
    subtitle: "وجّه الكاميرا لأي لافتة ليقرأها لك ويدلّك على الشباك الصحيح",
  },
  {
    id: "shortcuts",
    icon: "flash-outline",
    title: "اختصارات لمستنداتك المهمة",
    subtitle: "افتح بطاقتك أو رخصتك بإيماءة واحدة على الشاشة",
  },
  {
    id: "share",
    icon: "qr-code-outline",
    title: "مشاركة مستنداتك بسهولة",
    subtitle: "شارك أي مستند بكود QR واضح أو ملف PDF",
  },
];
