export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  return Response.json(
    {
      ok: true,
      version: "automatic-polling-disabled",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "CDN-Cache-Control": "public, s-maxage=86400",
        "Vercel-CDN-Cache-Control": "public, s-maxage=86400",
      },
    }
  );
}