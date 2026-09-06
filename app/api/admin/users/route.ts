import { NextResponse } from "next/server";
import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type CreateUserBody = {
  displayName?: string;
  email?: string;
  password?: string;
  admin?: boolean;

  permissions?: {
    tee_sheet?: boolean;
    changes?: boolean;
    pro_shop?: boolean;
    reciprocals?: boolean;
    bag_finder?: boolean;
    golf_carts?: boolean;
    tv?: boolean;
  };
};

function cleanEmail(
  value: string
) {
  return value
    .trim()
    .toLowerCase();
}

export async function POST(
  request: Request
) {
  /*
    Authenticate the person making
    the request with the normal
    GolfOps browser session.
  */

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "You must be signed in.",
      },
      {
        status: 401,
      }
    );
  }

  /*
    Confirm caller is a GolfOps Admin.
  */

  const {
    data: adminProfile,
    error: profileError,
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
    profileError ||
    !adminProfile?.club_id ||
    adminProfile.role !==
      "admin"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Admin access required.",
      },
      {
        status: 403,
      }
    );
  }

  /*
    Read and validate request.
  */

  let body:
    CreateUserBody;

  try {
    body =
      (await request.json()) as
        CreateUserBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Invalid request.",
      },
      {
        status: 400,
      }
    );
  }

  const displayName =
    typeof body.displayName ===
      "string"
      ? body.displayName.trim()
      : "";

  const email =
    typeof body.email ===
      "string"
      ? cleanEmail(
          body.email
        )
      : "";

  const password =
    typeof body.password ===
      "string"
      ? body.password
      : "";

  const isAdmin =
    body.admin === true;

  if (!displayName) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Name is required.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !email ||
    !email.includes("@")
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A valid email address is required.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    password.length < 8
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Temporary password must be at least 8 characters.",
      },
      {
        status: 400,
      }
    );
  }

  /*
    Privileged Supabase client.

    NEVER send this key to the browser.
  */

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    console.error(
      "GolfOps Admin user creation configuration missing."
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "User creation is not configured on the server.",
      },
      {
        status: 500,
      }
    );
  }

  const adminSupabase =
    createAdminClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,
        },
      }
    );

  /*
    Create Supabase Auth user.

    email_confirm = true means the
    employee can immediately sign in
    with the temporary password.
  */

  const {
    data: createdUserData,
    error: createUserError,
  } =
    await adminSupabase
      .auth
      .admin
      .createUser({
        email,
        password,
        email_confirm: true,

        user_metadata: {
          display_name:
            displayName,
        },
      });

  if (
    createUserError ||
    !createdUserData.user
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          createUserError
            ?.message ??
          "Unable to create user.",
      },
      {
        status: 400,
      }
    );
  }

  const newUser =
    createdUserData.user;

  /*
    Create GolfOps profile.
  */

  const {
    error: profileInsertError,
  } =
    await adminSupabase
      .from("profiles")
      .insert({
        id:
          newUser.id,

        club_id:
          adminProfile.club_id,

        display_name:
          displayName,

        role:
          isAdmin
            ? "admin"
            : "staff",
      });

  if (
    profileInsertError
  ) {
    /*
      Roll back Auth user if profile
      creation fails.
    */

    await adminSupabase
      .auth
      .admin
      .deleteUser(
        newUser.id
      );

    return NextResponse.json(
      {
        ok: false,
        error:
          profileInsertError.message,
      },
      {
        status: 500,
      }
    );
  }

  /*
    Create module permissions.

    Admins technically do not need these
    values because Admin access overrides
    them, but storing all TRUE keeps the
    record consistent.
  */

  const requestedPermissions =
    body.permissions ?? {};

  const permissions =
    isAdmin
      ? {
          tee_sheet: true,
          changes: true,
          pro_shop: true,
          reciprocals: true,
          bag_finder: true,
          golf_carts: true,
          tv: true,
        }
      : {
          tee_sheet:
            requestedPermissions
              .tee_sheet ??
            true,

          changes:
            requestedPermissions
              .changes ??
            true,

          pro_shop:
            requestedPermissions
              .pro_shop ??
            true,

          reciprocals:
            requestedPermissions
              .reciprocals ??
            true,

          bag_finder:
            requestedPermissions
              .bag_finder ??
            true,

          golf_carts:
            requestedPermissions
              .golf_carts ??
            true,

          tv:
            requestedPermissions
              .tv ??
            true,
        };

  const {
    error:
      permissionInsertError,
  } =
    await adminSupabase
      .from(
        "user_permissions"
      )
      .insert({
        user_id:
          newUser.id,

        club_id:
          adminProfile.club_id,

        ...permissions,
      });

  if (
    permissionInsertError
  ) {
    /*
      Roll back both profile and Auth user
      if permission setup fails.
    */

    await adminSupabase
      .from("profiles")
      .delete()
      .eq(
        "id",
        newUser.id
      );

    await adminSupabase
      .auth
      .admin
      .deleteUser(
        newUser.id
      );

    return NextResponse.json(
      {
        ok: false,
        error:
          permissionInsertError.message,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    ok: true,

    user: {
      id:
        newUser.id,

      display_name:
        displayName,

      email,

      role:
        isAdmin
          ? "admin"
          : "staff",

      permissions,
    },
  });
}

type DeleteUserBody = {
  userId?: string;
};

export async function DELETE(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in." },
      { status: 401 }
    );
  }

  const { data: adminProfile, error: profileError } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !adminProfile?.club_id ||
    adminProfile.role !== "admin"
  ) {
    return NextResponse.json(
      { ok: false, error: "Admin access required." },
      { status: 403 }
    );
  }

  let body: DeleteUserBody;

  try {
    body = (await request.json()) as DeleteUserBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 }
    );
  }

  const targetUserId =
    typeof body.userId === "string" ? body.userId.trim() : "";

  if (!targetUserId) {
    return NextResponse.json(
      { ok: false, error: "User ID is required." },
      { status: 400 }
    );
  }

  if (targetUserId === user.id) {
    return NextResponse.json(
      { ok: false, error: "You cannot remove your own account." },
      { status: 400 }
    );
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from("profiles")
    .select("id, club_id")
    .eq("id", targetUserId)
    .single();

  if (
    targetProfileError ||
    !targetProfile ||
    targetProfile.club_id !== adminProfile.club_id
  ) {
    return NextResponse.json(
      { ok: false, error: "User was not found for your club." },
      { status: 404 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("GolfOps Admin user removal configuration missing.");

    return NextResponse.json(
      { ok: false, error: "User removal is not configured on the server." },
      { status: 500 }
    );
  }

  const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error: deleteUserError } =
    await adminSupabase.auth.admin.deleteUser(targetUserId);

  if (deleteUserError) {
    return NextResponse.json(
      { ok: false, error: deleteUserError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
