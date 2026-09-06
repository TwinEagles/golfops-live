import { createClient } from "@supabase/supabase-js";
import { parseForeTeesServerHtml } from "@/lib/foretees-server-parser";
import { compareTeeSheets } from "@/lib/comparison-engine";

function convertTeeTimeTo24Hour(value: string) {
  const match = value
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    throw new Error(`Invalid tee time: ${value}`);
  }

  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3].toUpperCase();

  if (meridiem === "AM" && hour === 12) {
    hour = 0;
  }

  if (meridiem === "PM" && hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${minute}:00`;
}

function normalizeBagNumber(value: string | null) {
  return (value ?? "").trim().toUpperCase();
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeSheetDate(
  value: unknown
) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned =
    value.trim();

  let match =
    cleaned.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (!match) {
    match =
      cleaned.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
      );

    if (match) {
      match = [
        match[0],
        match[3],
        match[1],
        match[2],
      ];
    }
  }

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const candidate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function splitPlayerName(value: string) {
  const cleaned =
    value.trim().replace(/\s+/g, " ");

  if (!cleaned) {
    return {
      firstName: "",
      lastName: "",
      fullName: "",
    };
  }

  if (cleaned.includes(",")) {
    const [last, ...rest] =
      cleaned.split(",");

    const first =
      rest.join(",").trim();

    return {
      firstName: first,
      lastName: last.trim(),
      fullName: cleaned,
    };
  }

  const parts =
    cleaned.split(" ");

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
      fullName: cleaned,
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    fullName: cleaned,
  };
}

function slotKey(
  teeTime: string,
  course: string,
  startingPosition: string,
  slotPosition: number
) {
  return [
    teeTime,
    course.trim().toLowerCase(),
    startingPosition.trim().toUpperCase(),
    slotPosition,
  ].join("|");
}

type ExistingSlot = {
  id: number;
  tee_time: string;
  course: string;
  starting_hole: number;
  starting_position: string | null;
  slot_position: number;
  player_name: string | null;
  member_id: number | null;
  bag_number: string | null;
  cart_number: string | null;
  check_in: string | null;
  notes: string | null;
  highlight: string | null;
  event_color: string | null;
  played_today: boolean | null;
  source?: string | null;
};

export async function POST(request: Request) {
  try {
    /*
      AUTHENTICATION
    */

    const authHeader =
      request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        {
          ok: false,
          error: "Missing authorization token.",
        },
        {
          status: 401,
        }
      );
    }

    const accessToken = authHeader
      .replace("Bearer ", "")
      .trim();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },

        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(
      accessToken
    );

    if (authError || !user) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid or expired Cart Barn Live 2 login.",
        },
        {
          status: 401,
        }
      );
    }

    /*
      REQUEST DATA
    */

    const body = await request.json();

    const html =
      typeof body?.html === "string"
        ? body.html
        : "";

    const source =
      typeof body?.source === "string"
        ? body.source
        : "A";

    const sourceUrl =
      typeof body?.url === "string"
        ? body.url
        : null;

    const timezone =
      typeof body?.timezone === "string"
        ? body.timezone
        : "America/New_York";

    const requestedSheetDate =
      normalizeSheetDate(
        body?.sheetDate
      );

    if (!html) {
      return Response.json(
        {
          ok: false,
          error:
            "No ForeTees HTML was supplied.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      PARSE FORETEES
    */

    const parsed =
      parseForeTeesServerHtml(html);

    if (requestedSheetDate) {
      parsed.sheetDate =
        requestedSheetDate;
    }

    if (!parsed.sheetDate) {
      return Response.json(
        {
          ok: false,
          error:
            "Unable to detect the tee sheet date.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      parsed.teeTimes.length === 0
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "No ForeTees tee times were detected.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      IDENTIFY CLUB
    */

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("club_id, role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile?.club_id
    ) {
      console.error(
        "Profile lookup error:",
        profileError
      );

      return Response.json(
        {
          ok: false,
          error:
            "Unable to determine your club.",
        },
        {
          status: 403,
        }
      );
    }

    const clubId =
      profile.club_id;

    /*
      TEE SHEET PERMISSION

      The Chrome extension authenticates with a
      bearer token instead of the browser cookie
      session, so permission checking must use the
      same bearer-authenticated Supabase client.

      Admins always have access. Standard Users
      must explicitly have tee_sheet = true.
    */

    if (profile.role !== "admin") {
      const {
        data: permission,
        error: permissionError,
      } = await supabase
        .from("user_permissions")
        .select("tee_sheet")
        .eq("user_id", user.id)
        .eq("club_id", clubId)
        .maybeSingle();

      if (
        permissionError ||
        permission?.tee_sheet !== true
      ) {
        if (permissionError) {
          console.error(
            "Tee Sheet permission lookup error:",
            permissionError
          );
        }

        return Response.json(
          {
            ok: false,
            error:
              "You do not have access to Tee Sheet imports.",
          },
          {
            status: 403,
          }
        );
      }
    }

    /*
      LOAD MEMBER DATABASE
    */

    const {
      data: members,
      error: membersError,
    } = await supabase
      .from("members")
      .select(`
        id,
        first_name,
        last_name,
        full_name,
        member_number,
        bag_number
      `)
      .eq(
        "club_id",
        clubId
      );

    if (membersError) {
      console.error(
        "Member lookup error:",
        membersError
      );

      return Response.json(
        {
          ok: false,
          error:
            "Unable to load the Member Database.",
        },
        {
          status: 500,
        }
      );
    }

    /*
      MEMBER LOOKUP INDEXES
    */

    const memberByBag =
      new Map<
        string,
        NonNullable<
          typeof members
        >[number]
      >();

    const memberByName =
      new Map<
        string,
        NonNullable<
          typeof members
        >[number]
      >();

    const duplicateMemberNames =
      new Set<string>();

    const allMemberNames =
      new Set<string>();

    for (
      const member of
        members ?? []
    ) {
      const bag =
        normalizeBagNumber(
          member.bag_number
        );

      if (bag) {
        memberByBag.set(
          bag,
          member
        );
      }

      const name =
        normalizeName(
          member.full_name ||
            `${member.first_name ?? ""} ${
              member.last_name ?? ""
            }`
        );

      if (name) {
        allMemberNames.add(name);

        if (
          memberByName.has(name)
        ) {
          duplicateMemberNames.add(
            name
          );
        } else {
          memberByName.set(
            name,
            member
          );
        }
      }
    }

    for (
      const duplicateName of
        duplicateMemberNames
    ) {
      memberByName.delete(
        duplicateName
      );
    }

    /*
      AUTO-ADD BAG FINDER MEMBERS

      If ForeTees contains a player with:
      - a nonblank bag number
      - a nonblank player name
      - no existing member by bag
      - no existing member by name

      create that person in the Member Database.
      This mirrors the intended Bag Finder behavior:
      adding a bag number in ForeTees is enough to
      make a new person appear in Bag Finder.

      Names already present anywhere in the Member
      Database are never auto-created again.
    */

    const newMemberCandidates =
      new Map<
        string,
        {
          fullName: string;
          firstName: string;
          lastName: string;
          bagNumber: string;
        }
      >();

    const ambiguousNewMembers =
      new Set<string>();

    for (
      const teeTime of
        parsed.teeTimes
    ) {
      for (
        const player of
          teeTime.players
      ) {
        const playerName =
          (player.playerName ?? "")
            .trim();

        const bagNumber =
          normalizeBagNumber(
            player.bagNumber
          );

        if (
          !playerName ||
          !bagNumber ||
          !/\d/.test(bagNumber)
        ) {
          continue;
        }

        if (
          memberByBag.has(
            bagNumber
          )
        ) {
          continue;
        }

        const normalizedName =
          normalizeName(
            playerName
          );

        if (
          !normalizedName ||
          allMemberNames.has(
            normalizedName
          )
        ) {
          continue;
        }

        const parsedName =
          splitPlayerName(
            playerName
          );

        const existingCandidate =
          newMemberCandidates.get(
            normalizedName
          );

        if (
          existingCandidate &&
          existingCandidate.bagNumber !==
            bagNumber
        ) {
          ambiguousNewMembers.add(
            normalizedName
          );

          newMemberCandidates.delete(
            normalizedName
          );

          continue;
        }

        if (
          !ambiguousNewMembers.has(
            normalizedName
          )
        ) {
          newMemberCandidates.set(
            normalizedName,
            {
              fullName:
                parsedName.fullName,
              firstName:
                parsedName.firstName,
              lastName:
                parsedName.lastName,
              bagNumber,
            }
          );
        }
      }
    }

    let membersAdded =
      0;

    const memberAddWarnings:
      string[] = [];

    if (
      newMemberCandidates.size >
      0
    ) {
      const rowsToInsert =
        Array.from(
          newMemberCandidates.values()
        ).map(
          (candidate) => ({
            club_id:
              clubId,

            first_name:
              candidate.firstName ||
              null,

            last_name:
              candidate.lastName ||
              null,

            full_name:
              candidate.fullName,

            member_number:
              null,

            bag_number:
              candidate.bagNumber,
          })
        );

      const {
        data: addedMembers,
        error: addMembersError,
      } = await supabase
        .from("members")
        .insert(
          rowsToInsert
        )
        .select(`
          id,
          first_name,
          last_name,
          full_name,
          member_number,
          bag_number
        `);

      if (
        addMembersError
      ) {
        console.error(
          "Automatic member add error:",
          addMembersError
        );

        memberAddWarnings.push(
          `Unable to automatically add ${rowsToInsert.length} new Bag Finder member${
            rowsToInsert.length === 1
              ? ""
              : "s"
          }.`
        );
      } else {
        for (
          const member of
            addedMembers ?? []
        ) {
          membersAdded += 1;

          const bag =
            normalizeBagNumber(
              member.bag_number
            );

          if (bag) {
            memberByBag.set(
              bag,
              member
            );
          }

          const name =
            normalizeName(
              member.full_name ||
                `${member.first_name ?? ""} ${
                  member.last_name ?? ""
                }`
            );

          if (name) {
            memberByName.set(
              name,
              member
            );

            allMemberNames.add(
              name
            );
          }

          memberAddWarnings.push(
            `Bag Finder added ${
              member.full_name ||
              "new member"
            } with bag ${
              member.bag_number ||
              ""
            }.`
          );
        }
      }
    }

    if (
      ambiguousNewMembers.size >
      0
    ) {
      memberAddWarnings.push(
        `${ambiguousNewMembers.size} new member${
          ambiguousNewMembers.size === 1
            ? ""
            : "s"
        } skipped because ForeTees supplied conflicting bag numbers for the same name.`
      );
    }

    /*
      LOAD CURRENT FORETEES SLOTS

      These are the previous imported
      source-A positions.

      They are used for:

      - operational preservation
      - ForeTees comparison
    */

    const {
      data: existingForeTeesSlots,
      error: existingSlotsError,
    } = await supabase
      .from("tee_sheet_slots")
      .select(`
        id,
        tee_time,
        course,
        starting_hole,
        starting_position,
        slot_position,
        player_name,
        member_id,
        bag_number,
        cart_number,
        check_in,
        notes,
        highlight,
        event_color,
        played_today,
        source
      `)
      .eq(
        "club_id",
        clubId
      )
      .eq(
        "sheet_date",
        parsed.sheetDate
      )
      .eq(
        "source",
        source
      );

    if (existingSlotsError) {
      console.error(
        "Existing tee sheet lookup error:",
        existingSlotsError
      );

      return Response.json(
        {
          ok: false,
          error:
            "Unable to read the existing tee sheet.",
        },
        {
          status: 500,
        }
      );
    }

    /*
      LOAD MANUAL OVERRIDES

      A MANUAL row represents an explicit
      Cart Barn Live 2 decision.

      This includes:

      - manually added member
      - manually added guest
      - manually removed player
        (empty MANUAL slot)

      MANUAL rows take priority over
      anything ForeTees reports for the
      same physical position.
    */

    const {
      data: manualSlots,
      error: manualSlotsError,
    } = await supabase
      .from("tee_sheet_slots")
      .select(`
        id,
        tee_time,
        course,
        starting_hole,
        starting_position,
        slot_position,
        player_name,
        member_id,
        bag_number,
        cart_number,
        check_in,
        notes,
        highlight,
        event_color,
        played_today,
        source
      `)
      .eq(
        "club_id",
        clubId
      )
      .eq(
        "sheet_date",
        parsed.sheetDate
      )
      .eq(
        "source",
        "MANUAL"
      );

    if (manualSlotsError) {
      console.error(
        "Manual tee sheet lookup error:",
        manualSlotsError
      );

      return Response.json(
        {
          ok: false,
          error:
            "Unable to load manual tee sheet overrides.",
        },
        {
          status: 500,
        }
      );
    }

    /*
      BUILD MANUAL POSITION INDEX

      Even an EMPTY manual slot must block
      the ForeTees row for that position.

      This is how a manually removed player
      remains removed after another sync.
    */

    const manualPositionKeys =
      new Set<string>();

    for (
      const slot of
        manualSlots ?? []
    ) {
      manualPositionKeys.add(
        slotKey(
          slot.tee_time,
          slot.course,
          slot.starting_position ??
            String(
              slot.starting_hole
            ),
          slot.slot_position
        )
      );
    }

    /*
      DETERMINE FIRST IMPORT
    */

    const {
      count: priorImportCount,
      error: priorImportError,
    } = await supabase
      .from(
        "tee_sheet_imports"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "club_id",
        clubId
      )
      .eq(
        "sheet_date",
        parsed.sheetDate
      );

    if (priorImportError) {
      console.error(
        "Prior import lookup error:",
        priorImportError
      );
    }

    const isNewDay =
      !priorImportCount ||
      priorImportCount === 0;

    /*
      CREATE IMPORT HISTORY
    */

    const {
      data: importRecord,
      error: importError,
    } = await supabase
      .from(
        "tee_sheet_imports"
      )
      .insert({
        club_id:
          clubId,

        sheet_date:
          parsed.sheetDate,

        source,

        source_url:
          sourceUrl,

        timezone,

        imported_players:
          parsed.occupiedPlayers,

        members_added:
          0,

        members_updated:
          0,

        is_new_day:
          isNewDay,

        warnings:
          [],

        parsed_snapshot:
          parsed,

        created_by:
          user.id,
      })
      .select("id")
      .single();

    if (
      importError ||
      !importRecord
    ) {
      console.error(
        "Import record error:",
        importError
      );

      return Response.json(
        {
          ok: false,
          error:
            `Unable to create import record: ${
              importError?.message ??
              "Unknown error"
            }`,
        },
        {
          status: 500,
        }
      );
    }

    /*
      INDEX EXISTING FORETEES POSITIONS

      Used to preserve check-in,
      cart number, notes, etc.
    */

    const existingByPosition =
      new Map<
        string,
        NonNullable<
          typeof existingForeTeesSlots
        >[number]
      >();

    for (
      const slot of
        existingForeTeesSlots ?? []
    ) {
      existingByPosition.set(
        slotKey(
          slot.tee_time,
          slot.course,
          slot.starting_position ??
            String(
              slot.starting_hole
            ),
          slot.slot_position
        ),
        slot
      );
    }

    let preservedCheckIns =
      0;

    let preservedCartNumbers =
      0;

    const bagUpdateCandidates =
      new Map<
        number,
        {
          memberId: number;
          memberName: string;
          oldBag: string | null;
          newBag: string | null;
        }
      >();

    const ambiguousBagUpdates =
      new Set<number>();

    /*
      BUILD RAW NEW FORETEES SLOTS

      We initially build all four slots
      exactly as ForeTees reports them.
    */

    const rawIncomingSlots =
      parsed.teeTimes.flatMap(
        (teeTime) => {
          const convertedTime =
            convertTeeTimeTo24Hour(
              teeTime.teeTime
            );

          return teeTime.players.map(
            (
              player,
              playerIndex
            ) => {
              const position =
                playerIndex + 1;

              const bagNumber =
                normalizeBagNumber(
                  player.bagNumber
                ) || null;

              let matchedMember =
                bagNumber
                  ? memberByBag.get(
                      bagNumber
                    )
                  : undefined;

              if (
                !matchedMember &&
                player.playerName
              ) {
                matchedMember =
                  memberByName.get(
                    normalizeName(
                      player.playerName
                    )
                  );
              }

              /*
                If ForeTees now has a bag number
                for an existing member whose Bag
                Finder record is blank or different,
                queue that member for an update.

                Example:
                Jeffrey Dierks already exists in
                members with no bag, then ForeTees
                reports 1347 -> update Jeffrey to 1347.
              */

              if (
                matchedMember
              ) {
                const currentMemberBag =
                  normalizeBagNumber(
                    matchedMember.bag_number
                  );

                const incomingBag =
                  bagNumber || null;

                if (
                  currentMemberBag !==
                    (incomingBag ?? "")
                ) {
                  const existingCandidate =
                    bagUpdateCandidates.get(
                      matchedMember.id
                    );

                  if (
                    existingCandidate &&
                    existingCandidate.newBag !==
                      incomingBag
                  ) {
                    ambiguousBagUpdates.add(
                      matchedMember.id
                    );

                    bagUpdateCandidates.delete(
                      matchedMember.id
                    );
                  } else if (
                    !ambiguousBagUpdates.has(
                      matchedMember.id
                    )
                  ) {
                    bagUpdateCandidates.set(
                      matchedMember.id,
                      {
                        memberId:
                          matchedMember.id,

                        memberName:
                          matchedMember.full_name ||
                          `${matchedMember.first_name ?? ""} ${
                            matchedMember.last_name ?? ""
                          }`.trim() ||
                          player.playerName ||
                          `Member ${matchedMember.id}`,

                        oldBag:
                          matchedMember.bag_number,

                        newBag:
                          incomingBag,
                      }
                    );
                  }
                }
              }

              const physicalKey =
                slotKey(
                  convertedTime,
                  teeTime.course,
                  teeTime.startingPosition,
                  position
                );

              const previousSlot =
                existingByPosition.get(
                  physicalKey
                );

              const previousPlayer =
                normalizeName(
                  previousSlot
                    ?.player_name ??
                    ""
                );

              const incomingPlayer =
                normalizeName(
                  player.playerName ??
                    ""
                );

              const samePlayer =
                !!previousPlayer &&
                !!incomingPlayer &&
                previousPlayer ===
                  incomingPlayer;

              const preservedCheckIn =
                samePlayer
                  ? previousSlot
                      ?.check_in ??
                    ""
                  : "";

              const preservedCartNumber =
                samePlayer
                  ? previousSlot
                      ?.cart_number ??
                    null
                  : null;

              if (
                preservedCheckIn
              ) {
                preservedCheckIns +=
                  1;
              }

              if (
                preservedCartNumber
              ) {
                preservedCartNumbers +=
                  1;
              }

              return {
                club_id:
                  clubId,

                import_id:
                  importRecord.id,

                sheet_date:
                  parsed.sheetDate,

                source,

                tee_time:
                  convertedTime,

                course:
                  teeTime.course,

                starting_hole:
                  teeTime.startingHole,

                starting_position:
                  teeTime.startingPosition,

                holes:
                  player.cw
                    ?.toUpperCase()
                    .includes("9")
                    ? 9
                    : 18,

                slot_position:
                  position,

                raw_player_name:
                  player.playerName ||
                  null,

                player_name:
                  player.playerName ||
                  null,

                member_id:
                  matchedMember?.id ??
                  null,

                member_number:
                  matchedMember
                    ?.member_number ??
                  null,

                bag_number:
                  bagNumber,

                cw:
                  player.cw ||
                  null,

                cart_number:
                  preservedCartNumber,

                check_in:
                  preservedCheckIn,

                notes:
                  samePlayer
                    ? previousSlot
                        ?.notes ??
                      null
                    : null,

                highlight:
                  samePlayer
                    ? previousSlot
                        ?.highlight ??
                      null
                    : null,

                event_color:
                  samePlayer
                    ? previousSlot
                        ?.event_color ??
                      null
                    : null,

                played_today:
                  samePlayer
                    ? previousSlot
                        ?.played_today ??
                      false
                    : false,

                /*
                  Internal helper only.
                  Removed before database insert.
                */

                __physicalKey:
                  physicalKey,
              };
            }
          );
        }
      );

    /*
      FILTER FORETEES AGAINST MANUAL OVERRIDES

      If Cart Barn Live 2 has a MANUAL row
      occupying a position, do not insert
      the incoming ForeTees row there.

      This prevents unique-index conflicts
      and preserves the manual decision.
    */

    const foreTeesSlotsToInsert =
      rawIncomingSlots.filter(
        (slot) =>
          !manualPositionKeys.has(
            slot.__physicalKey
          )
      );

    /*
      Database-ready incoming rows.

      Strip internal __physicalKey field.
    */

    const slots =
      foreTeesSlotsToInsert.map(
        ({
          __physicalKey,
          ...slot
        }) => slot
      );

    /*
      EFFECTIVE CURRENT SHEET

      The comparison engine should see the
      same sheet the staff currently sees:

      previous ForeTees rows
      +
      manual overrides.

      A manual position replaces the old
      ForeTees position.
    */

    const existingEffectiveSlots = [
      ...(existingForeTeesSlots ??
        []).filter((slot) => {
        const key =
          slotKey(
            slot.tee_time,
            slot.course,
            slot.starting_position ??
              String(
                slot.starting_hole
              ),
            slot.slot_position
          );

        return (
          !manualPositionKeys.has(
            key
          )
        );
      }),

      ...(manualSlots ?? []),
    ];

    /*
      EFFECTIVE NEW SHEET

      This is what the user will see after
      the new import:

      new ForeTees rows
      +
      unchanged manual overrides.
    */

    const incomingEffectiveSlots = [
      ...slots,

      ...(manualSlots ?? []),
    ];

    /*
      COMPARE OLD VS NEW

      Important:

      Because manual rows appear on BOTH
      sides of the comparison, a manual add
      or removal will NOT incorrectly appear
      as a new ForeTees change on the next sync.
    */

    let detectedChanges:
      ReturnType<
        typeof compareTeeSheets
      > = [];

    if (
      !isNewDay &&
      existingEffectiveSlots.length >
        0
    ) {
      detectedChanges =
        compareTeeSheets(
          existingEffectiveSlots.map(
            (slot) => ({
              id:
                slot.id,

              tee_time:
                slot.tee_time,

              course:
                slot.course,

              starting_hole:
                slot.starting_hole,

              starting_position:
                slot.starting_position,

              slot_position:
                slot.slot_position,

              player_name:
                slot.player_name,

              member_id:
                slot.member_id,

              bag_number:
                slot.bag_number,
            })
          ),

          incomingEffectiveSlots.map(
            (slot) => ({
              tee_time:
                slot.tee_time,

              course:
                slot.course,

              starting_hole:
                slot.starting_hole,

              starting_position:
                slot.starting_position,

              slot_position:
                slot.slot_position,

              player_name:
                slot.player_name,

              member_id:
                slot.member_id,

              bag_number:
                slot.bag_number,
            })
          )
        );
    }

    /*
      SAVE DETECTED CHANGES
    */

    if (
      detectedChanges.length >
      0
    ) {
      const changeRows =
        detectedChanges.map(
          (change) => ({
            club_id:
              clubId,

            import_id:
              importRecord.id,

            sheet_date:
              parsed.sheetDate,

            change_type:
              change.change_type,

            member_id:
              change.member_id,

            player_name:
              change.player_name,

            bag_number:
              change.bag_number,

            cart_number:
              null,

            tee_time:
              change.tee_time,

            starting_hole:
              change.starting_hole,

            detail:
              change.detail,

            old_value:
              change.old_value,

            new_value:
              change.new_value,

            status:
              "OPEN",
          })
        );

      const {
        error: changesError,
      } = await supabase
        .from(
          "tee_sheet_changes"
        )
        .insert(
          changeRows
        );

      if (changesError) {
        console.error(
          "Change tracking insert error:",
          changesError
        );

        return Response.json(
          {
            ok: false,
            error:
              `Unable to save tee sheet changes: ${changesError.message}`,
          },
          {
            status: 500,
          }
        );
      }
    }

    /*
      DELETE ONLY THE PREVIOUS FORETEES ROWS

      MANUAL rows remain untouched.
    */

    const {
      error: deleteError,
    } = await supabase
      .from(
        "tee_sheet_slots"
      )
      .delete()
      .eq(
        "club_id",
        clubId
      )
      .eq(
        "sheet_date",
        parsed.sheetDate
      )
      .eq(
        "source",
        source
      );

    if (deleteError) {
      console.error(
        "Existing slot cleanup error:",
        deleteError
      );

      return Response.json(
        {
          ok: false,
          error:
            `Unable to replace existing tee sheet: ${deleteError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    /*
      INSERT NEW FORETEES ROWS

      Positions occupied by MANUAL rows
      have already been removed from this
      list, preventing unique-key conflicts.
    */

    const {
      error: slotError,
    } = await supabase
      .from(
        "tee_sheet_slots"
      )
      .insert(
        slots
      );

    if (slotError) {
      console.error(
        "Tee sheet slot insert error:",
        slotError
      );

      return Response.json(
        {
          ok: false,
          error:
            `Unable to save tee sheet: ${slotError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    /*
      UPDATE BAG FINDER FROM THIS IMPORT

      ForeTees is the operational source of
      truth for bag numbers. On a confident
      member match, a changed bag number updates
      Bag Finder and a blank ForeTees bag clears
      the member's existing bag number.

      Duplicate names and conflicting bag
      values are skipped.
    */

    let membersUpdated =
      0;

    const bagSyncWarnings:
      string[] = [];

    for (
      const candidate of
        bagUpdateCandidates.values()
    ) {
      const {
        error: memberBagUpdateError,
      } = await supabase
        .from("members")
        .update({
          bag_number:
            candidate.newBag,
        })
        .eq(
          "club_id",
          clubId
        )
        .eq(
          "id",
          candidate.memberId
        );

      if (
        memberBagUpdateError
      ) {
        console.error(
          "Member bag sync error:",
          memberBagUpdateError
        );

        bagSyncWarnings.push(
          `Bag Finder update failed for ${candidate.memberName}: ${
            candidate.oldBag || "blank"
          } -> ${candidate.newBag || "No Bag"}`
        );
      } else {
        membersUpdated += 1;

        bagSyncWarnings.push(
          `Bag Finder updated ${candidate.memberName}: ${
            candidate.oldBag || "blank"
          } -> ${candidate.newBag || "No Bag"}`
        );
      }
    }

    if (
      ambiguousBagUpdates.size >
      0
    ) {
      bagSyncWarnings.push(
        `${ambiguousBagUpdates.size} bag update${
          ambiguousBagUpdates.size === 1
            ? ""
            : "s"
        } skipped because ForeTees supplied conflicting bag numbers for the same member.`
      );
    }

    const {
      error: importMetricsError,
    } = await supabase
      .from(
        "tee_sheet_imports"
      )
      .update({
        members_added:
          membersAdded,

        members_updated:
          membersUpdated,

        warnings: [
          ...memberAddWarnings,
          ...bagSyncWarnings,
        ],
      })
      .eq(
        "id",
        importRecord.id
      )
      .eq(
        "club_id",
        clubId
      );

    if (
      importMetricsError
    ) {
      console.error(
        "Import metrics update error:",
        importMetricsError
      );
    }

    /*
      RESPONSE METRICS
    */

    const matchedPlayers =
      slots.filter(
        (slot) =>
          slot.member_id
      ).length;

    const manualOverridesPreserved =
      manualSlots?.length ??
      0;

    return Response.json({
      ok: true,

      message:
        "ForeTees tee sheet imported successfully.",

      sheetDate:
        parsed.sheetDate,

      teeTimesFound:
        parsed.teeTimes.length,

      playersFound:
        parsed.occupiedPlayers,

      slotsSaved:
        slots.length,

      membersMatched:
        matchedPlayers,

      changesDetected:
        detectedChanges.length,

      preservedCheckIns,

      preservedCartNumbers,

      manualOverridesPreserved,

      membersAdded,

      membersUpdated,

      bagUpdatesSkipped:
        ambiguousBagUpdates.size,

      memberAddWarnings,

      bagSyncWarnings,

      source,

      isNewDay,
    });
  } catch (error) {
    console.error(
      "Extension import error:",
      error
    );

    return Response.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to import the ForeTees tee sheet.",
      },
      {
        status: 500,
      }
    );
  }
}
