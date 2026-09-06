import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function parseCsvLine(
  line: string
) {
  const values: string[] =
    [];

  let current = "";
  let insideQuotes =
    false;

  for (
    let i = 0;
    i < line.length;
    i++
  ) {
    const char =
      line[i];

    if (char === '"') {
      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i++;
      } else {
        insideQuotes =
          !insideQuotes;
      }
    } else if (
      char === "," &&
      !insideQuotes
    ) {
      values.push(
        current
      );

      current = "";
    } else {
      current += char;
    }
  }

  values.push(
    current
  );

  return values.map(
    (value) =>
      value.trim()
  );
}

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: profile,
    } =
      await supabase
        .from("profiles")
        .select(
          "club_id, role"
        )
        .eq(
          "id",
          user.id
        )
        .single();

     if (
      !profile?.club_id ||
      profile.role !==
        "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to import members.",
        },
        {
          status: 403,
        }
      );
    }

    const formData =
      await request.formData();

    const file =
      formData.get(
        "file"
      );

    if (
      !(file instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            "CSV file is required.",
        },
        {
          status: 400,
        }
      );
    }

    const text =
      (await file.text())
        .replace(
          /^\uFEFF/,
          ""
        )
        .replace(
          /\r\n/g,
          "\n"
        )
        .replace(
          /\r/g,
          "\n"
        );

    const lines =
      text
        .split("\n")
        .filter(
          (line) =>
            line.trim()
        );

    if (
      lines.length < 2
    ) {
      return NextResponse.json(
        {
          error:
            "CSV contains no member records.",
        },
        {
          status: 400,
        }
      );
    }

    const header =
      parseCsvLine(
        lines[0]
      ).map(
        (value) =>
          value.toLowerCase()
      );

    const firstIndex =
      header.indexOf(
        "first name"
      );

    const lastIndex =
      header.indexOf(
        "last name"
      );

    const memberIndex =
      header.indexOf(
        "member number"
      );

    const bagIndex =
      header.indexOf(
        "bag number"
      );

    if (
      firstIndex === -1 ||
      lastIndex === -1 ||
      memberIndex === -1 ||
      bagIndex === -1
    ) {
      return NextResponse.json(
        {
          error:
            "CSV must contain First Name, Last Name, Member Number, and Bag Number columns.",
        },
        {
          status: 400,
        }
      );
    }

    const rows =
      lines
        .slice(1)
        .map(
          parseCsvLine
        )
        .map(
          (columns) => ({
            club_id:
              profile.club_id,

            first_name:
              columns[
                firstIndex
              ]?.trim() ||
              null,

            last_name:
              columns[
                lastIndex
              ]?.trim() ||
              null,

            member_number:
              columns[
                memberIndex
              ]?.trim() ||
              null,

            bag_number:
              columns[
                bagIndex
              ]?.trim() ||
              null,
          })
        )
        .filter(
          (row) =>
            row.first_name ||
            row.last_name
        );

    if (
      rows.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No valid members were found in the CSV.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      Roster import is treated as a
      complete roster replacement.
    */

    const {
      error: deleteError,
    } =
      await supabase
        .from("members")
        .delete()
        .eq(
          "club_id",
          profile.club_id
        );

    if (deleteError) {
      throw deleteError;
    }

    /*
      Insert in batches to avoid one
      oversized request.
    */

    const batchSize =
      500;

    for (
      let i = 0;
      i < rows.length;
      i += batchSize
    ) {
      const batch =
        rows.slice(
          i,
          i + batchSize
        );

      const {
        error,
      } =
        await supabase
          .from("members")
          .insert(
            batch
          );

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({
      ok: true,
      imported:
        rows.length,
    });
  } catch (error) {
    console.error(
      "Member CSV import error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to import member roster.",
      },
      {
        status: 500,
      }
    );
  }
}