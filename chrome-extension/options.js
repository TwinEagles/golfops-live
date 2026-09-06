const APP_URL =
  "https://golfops-live.vercel.app";

const emailInput =
  document.getElementById("email");

const passwordInput =
  document.getElementById("password");

const loginButton =
  document.getElementById("login");

const statusBox =
  document.getElementById("status");

statusBox.textContent =
  "Extension script loaded.";

chrome.storage.local.get(
  ["user_email"],
  (result) => {
    if (result.user_email) {
      emailInput.value =
        result.user_email;
    }
  }
);

loginButton.addEventListener(
  "click",
  async () => {
    statusBox.textContent =
      "Connecting...";

    const email =
      emailInput.value.trim();

    const password =
      passwordInput.value;

    if (!email || !password) {
      statusBox.textContent =
        "Enter your email and password.";

      return;
    }

    try {
      const response =
        await fetch(
          `${APP_URL}/api/extension/login`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              email,
              password,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.ok
      ) {
        statusBox.textContent =
          data.error ||
          "Unable to connect.";

        return;
      }

      await chrome.storage.local.set({
        access_token:
          data.access_token,

        refresh_token:
          data.refresh_token,

        expires_at:
          data.expires_at,

        user_email:
          data.email,
      });

      passwordInput.value = "";

      statusBox.textContent =
        "Connected successfully to GolfOps Live.";
    } catch (error) {
      console.error(
        "Extension login failed:",
        error
      );

      statusBox.textContent =
        "Unable to reach GolfOps Live.";
    }
  }
);