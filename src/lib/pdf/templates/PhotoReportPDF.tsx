import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import { join } from "path";

Font.register({
  family: "NotoSansJP",
  fonts: [
    {
      src: join(process.cwd(), "public/fonts/NotoSansJP.ttf"),
      fontWeight: 400,
    },
    {
      src: join(process.cwd(), "public/fonts/NotoSansJP.ttf"),
      fontWeight: 700,
    },
  ],
});

const FONT_FAMILY = "NotoSansJP";

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    padding: 24,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: "#1d4ed8",
    paddingBottom: 8,
  },
  companyName: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1d4ed8",
    marginBottom: 4,
  },
  headerMeta: {
    flexDirection: "row",
    gap: 16,
  },
  headerMetaText: {
    fontSize: 9,
    color: "#374151",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoCell: {
    width: "31.5%",
    marginBottom: 4,
  },
  photoImage: {
    width: "100%",
    height: 130,
    objectFit: "cover",
    borderRadius: 3,
    backgroundColor: "#f3f4f6",
  },
  photoCaption: {
    fontSize: 7.5,
    color: "#111827",
    marginTop: 3,
    lineHeight: 1.3,
  },
  photoTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    marginTop: 2,
  },
  tagBadge: {
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 6.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  photoDate: {
    fontSize: 7,
    color: "#9ca3af",
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 5,
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
  noPhoto: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },
  noPhotoText: {
    fontSize: 10,
    color: "#9ca3af",
  },
});

export type PhotoReportPDFProps = {
  title: string;
  project: { name: string; address: string | null };
  company: { name: string };
  photos: Array<{
    url: string;
    caption: string | null;
    takenAt: string | null;
    tags: Array<{ name: string }>;
  }>;
  createdAt: string;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 6枚ずつのチャンクに分割
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function PhotoReportPDF({
  title,
  project,
  company,
  photos,
  createdAt,
}: PhotoReportPDFProps) {
  const pages = chunkArray(photos, 6);
  const createdLabel = formatDate(createdAt);

  const headerBlock = (
    <View style={styles.header} fixed>
      <Text style={styles.companyName}>{company.name}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.headerMeta}>
        <Text style={styles.headerMetaText}>現場: {project.name}</Text>
        {project.address && (
          <Text style={styles.headerMetaText}>{project.address}</Text>
        )}
        <Text style={styles.headerMetaText}>作成日: {createdLabel}</Text>
      </View>
    </View>
  );

  if (photos.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          {headerBlock}
          <View style={styles.noPhoto}>
            <Text style={styles.noPhotoText}>写真がありません</Text>
          </View>
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>1 / 1</Text>
          </View>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {pages.map((pagePhotos, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {headerBlock}
          <View style={styles.grid}>
            {pagePhotos.map((photo, photoIndex) => (
              <View key={photoIndex} style={styles.photoCell}>
                <Image
                  style={styles.photoImage}
                  src={photo.url}
                />
                {photo.caption && (
                  <Text style={styles.photoCaption}>{photo.caption}</Text>
                )}
                {photo.tags.length > 0 && (
                  <View style={styles.photoTags}>
                    {photo.tags.map((tag, tagIndex) => (
                      <Text key={tagIndex} style={styles.tagBadge}>
                        {tag.name}
                      </Text>
                    ))}
                  </View>
                )}
                {photo.takenAt && (
                  <Text style={styles.photoDate}>
                    {formatDate(photo.takenAt)}
                  </Text>
                )}
              </View>
            ))}
          </View>
          <View style={styles.footer} fixed>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) =>
                `${pageNumber} / ${totalPages}`
              }
            />
          </View>
        </Page>
      ))}
    </Document>
  );
}
