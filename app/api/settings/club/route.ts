import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_SETTINGS = {
  // Cart signs
  placardDesign: "bold",
  cutAndStack: true,
  holeOrder: "1-18",

  // Tee sheet
  showPlayedTodayStar: true,
  showPreloadBagStar: true,

  // Name cleanup
  cleanUpNames: true,
  cleanupLabels: [
    "Talon",
    "Eagle",
    "PGA/Industry",
    "PGA Golf Pass",
    "PGA",
    "Event Guest",
    "Fam Guest",
    "Recip Guest",
    "Reciprocal",
    "Recip",
    "Guest",
    "Staff",
    "Member",
    "Outing",
  ],
  cleanupTags: [
    "SPT",
    "RNT",
    "SOC",
    "PGM",
    "JPGA",
    "BBE",
  ],
  customCleanupRules: [],

  // Changes
  showClearedChanges: false,
  clearedChangesRetentionDays: 30,

  // Appearance
  theme: "light",
  logoPath: "/twineagles-logo.png",

  // Golf carts
  cartDetailingDays: 30,
};

const ALLOWED_THEMES = [
  "navy",
  "midnight",
  "forest",
  "slate",
  "crimson",
  "gold",
  "light",
];

const ALLOWED_RETENTION_DAYS = [
  7,
  14,
  30,
  60,
  90,
];

function hasOwn(
  value: Record<string, unknown>,
  key: string
) {
  return Object.prototype.hasOwnProperty.call(
    value,
    key
  );
}

function stringArray(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}

function cleanupRules(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .filter(
      (item) =>
        item &&
        typeof item === "object"
    )
    .map((item) => {
      const rule =
        item as Record<
          string,
          unknown
        >;

      const ruleValue =
        typeof rule.value ===
        "string"
          ? rule.value.trim()
          : "";

      const mode =
        rule.mode === "anywhere"
          ? "anywhere"
          : "start";

      return {
        value: ruleValue,
        mode,
        enabled:
          rule.enabled !== false,
      };
    })
    .filter(
      (rule) =>
        Boolean(rule.value)
    );
}

async function getContext() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("club_id, role")
      .eq("id", user.id)
      .single();

  if (!profile?.club_id) {
    return null;
  }

  return {
    supabase,
    profile,
  };
}

export async function GET() {
  const context =
    await getContext();

  if (!context) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const {
    supabase,
    profile,
  } = context;

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "club_operational_settings"
      )
      .select("settings")
      .eq(
        "club_id",
        profile.club_id
      )
      .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    ok: true,

    settings: {
      ...DEFAULT_SETTINGS,
      ...(data?.settings ?? {}),
    },
  });
}

export async function PUT(
  request: Request
) {
  const context =
    await getContext();

  if (!context) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const {
    supabase,
    profile,
  } = context;

  if (
    profile.role !==
      "admin"
  ) {
    
    return NextResponse.json(
      {
        error:
          "You do not have permission to change club settings.",
      },
      {
        status: 403,
      }
    );
  }

  const body =
    (await request.json()) as
      Record<string, unknown>;

  /*
    Load the current JSON first.

    This is important because several
    GolfOps Live modules share the same
    club_operational_settings.settings
    object. Saving one Settings page
    must not erase values owned by
    another page/module.
  */

  const {
    data: existingRow,
    error: existingError,
  } =
    await supabase
      .from(
        "club_operational_settings"
      )
      .select("settings")
      .eq(
        "club_id",
        profile.club_id
      )
      .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      {
        error:
          existingError.message,
      },
      {
        status: 500,
      }
    );
  }

  const existingSettings =
    (
      existingRow?.settings &&
      typeof existingRow.settings ===
        "object"
    )
      ? (
          existingRow.settings as
            Record<
              string,
              unknown
            >
        )
      : {};

  const settings:
    Record<string, unknown> = {
      ...DEFAULT_SETTINGS,
      ...existingSettings,
  };

  /*
    Only update a setting when the
    request actually contains that key.

    This prevents Boolean(undefined)
    from silently turning unrelated
    settings off.
  */

  if (
    hasOwn(
      body,
      "placardDesign"
    )
  ) {
    settings.placardDesign =
      body.placardDesign ===
      "clean"
        ? "clean"
        : "bold";
  }

  if (
    hasOwn(
      body,
      "cutAndStack"
    )
  ) {
    settings.cutAndStack =
      body.cutAndStack ===
      true;
  }

  if (
    hasOwn(
      body,
      "holeOrder"
    )
  ) {
    settings.holeOrder =
      body.holeOrder ===
      "18-1"
        ? "18-1"
        : "1-18";
  }

  if (
    hasOwn(
      body,
      "showPlayedTodayStar"
    )
  ) {
    settings.showPlayedTodayStar =
      body.showPlayedTodayStar ===
      true;
  }

  if (
    hasOwn(
      body,
      "showPreloadBagStar"
    )
  ) {
    settings.showPreloadBagStar =
      body.showPreloadBagStar ===
      true;
  }

  if (
    hasOwn(
      body,
      "cleanUpNames"
    )
  ) {
    settings.cleanUpNames =
      body.cleanUpNames ===
      true;
  }

  if (
    hasOwn(
      body,
      "cleanupLabels"
    )
  ) {
    const values =
      stringArray(
        body.cleanupLabels
      );

    if (values) {
      settings.cleanupLabels =
        values;
    }
  }

  if (
    hasOwn(
      body,
      "cleanupTags"
    )
  ) {
    const values =
      stringArray(
        body.cleanupTags
      );

    if (values) {
      settings.cleanupTags =
        values;
    }
  }

  if (
    hasOwn(
      body,
      "customCleanupRules"
    )
  ) {
    const values =
      cleanupRules(
        body.customCleanupRules
      );

    if (values) {
      settings.customCleanupRules =
        values;
    }
  }

  if (
    hasOwn(
      body,
      "showClearedChanges"
    )
  ) {
    settings.showClearedChanges =
      body.showClearedChanges ===
      true;
  }

  if (
    hasOwn(
      body,
      "clearedChangesRetentionDays"
    )
  ) {
    const days =
      Number(
        body.clearedChangesRetentionDays
      );

    settings.clearedChangesRetentionDays =
      ALLOWED_RETENTION_DAYS.includes(
        days
      )
        ? days
        : 30;
  }

  if (
    hasOwn(
      body,
      "theme"
    )
  ) {
    settings.theme =
      typeof body.theme ===
        "string" &&
      ALLOWED_THEMES.includes(
        body.theme
      )
        ? body.theme
        : "light";
  }

  if (
    hasOwn(
      body,
      "logoPath"
    )
  ) {
    settings.logoPath =
      typeof body.logoPath ===
        "string" &&
      body.logoPath.trim()
        ? body.logoPath.trim()
        : "/twineagles-logo.png";
  }

  if (
    hasOwn(
      body,
      "cartDetailingDays"
    )
  ) {
    const days =
      Number(
        body.cartDetailingDays
      );

    if (
      Number.isFinite(days) &&
      days >= 1 &&
      days <= 365
    ) {
      settings.cartDetailingDays =
        Math.round(days);
    }
  }

  const {
    error,
  } =
    await supabase
      .from(
        "club_operational_settings"
      )
      .upsert(
        {
          club_id:
            profile.club_id,

          settings,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "club_id",
        }
      );

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    ok: true,
    settings,
  });
}
