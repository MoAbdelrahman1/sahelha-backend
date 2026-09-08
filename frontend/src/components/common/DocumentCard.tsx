import React from "react";
import { Pressable, Text, View } from "react-native";

import { useAppearance } from "@/store/appearanceStore";
import { palette, STATUS_META, DOC_TYPE_ACCENTS } from "@/styles/theme";
import { DOC_TYPE_LABELS, type Document } from "@/types/document";

type DocumentCardProps = {
  doc: Document;
  onPress: () => void;
};

// Reused by Home and Archive (src/components/common/ per ARCHITECTURE.md — a
// shared-by-2+-features domain component, not a generic content-agnostic
// primitive). Status is icon + label + color, never color alone
// (SAHELHA_DESIGN_BRIEF.md §5).
export function DocumentCard({ doc, onPress }: DocumentCardProps) {
  const { highContrast } = useAppearance();
  const c = palette(highContrast);
  const status = STATUS_META[doc.status];
  const typeLabel = doc.doc_type ? DOC_TYPE_LABELS[doc.doc_type] : "مستند";
  const accents = doc.doc_type ? DOC_TYPE_ACCENTS[doc.doc_type] : DOC_TYPE_ACCENTS.unknown;

  const lineText = doc.status === "processing" ? "لسه بيتقرا... هنعرفك أول ما يخلص" : doc.ai_summary || "";
  const statusColor = highContrast ? "#FFFFFF" : status.colorLight;
  const ariaLabel = `${typeLabel}، ${status.label}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      style={{
        flexDirection: "row-reverse",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: 16,
        borderRadius: 16,
        borderWidth: highContrast ? 2 : 1,
        borderColor: highContrast ? "#FFFFFF" : c.border,
        backgroundColor: c.pageBg,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          backgroundColor: highContrast ? "#000000" : accents.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 24,
            height: 30,
            borderWidth: 2.5,
            borderColor: highContrast ? "#FFFFFF" : accents.accent,
            borderRadius: 3,
          }}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 15, color: c.ink, textAlign: "right" }}>
          {typeLabel}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: "IBMPlexSansArabic_400Regular", fontSize: 13.5, color: c.secondary, textAlign: "right" }}
        >
          {lineText}
        </Text>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5 }}>
            <Text accessibilityElementsHidden style={{ fontSize: 12.5, fontWeight: "700", color: statusColor }}>
              {status.symbol}
            </Text>
            <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 12.5, color: statusColor }}>
              {status.label}
            </Text>
          </View>
          {doc.expirySoon ? (
            <View
              style={{
                paddingHorizontal: 9,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: c.expiryBg,
              }}
            >
              <Text style={{ fontFamily: "IBMPlexSansArabic_700Bold", fontSize: 12, color: c.expiryFg }}>
                قريب من الانتهاء
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={{
          width: 9,
          height: 9,
          borderTopWidth: 2.5,
          borderRightWidth: 2.5,
          borderColor: c.secondary,
          transform: [{ rotate: "-45deg" }],
        }}
      />
    </Pressable>
  );
}
