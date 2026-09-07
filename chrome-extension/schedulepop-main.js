(function () {
  const EVENT_NAME =
    "golfops-schedulepop-report";

  function announce(value) {
    try {
      const url =
        new URL(
          String(value),
          window.location.href
        );

      if (
        url.hostname ===
          "api.schedulepop.com" &&
        url.pathname.includes(
          "/printableSchedule"
        )
      ) {
        window.dispatchEvent(
          new CustomEvent(
            EVENT_NAME,
            {
              detail:
                url.toString()
            }
          )
        );
      }
    } catch {
      // Ignore values that are not URLs.
    }
  }

  const originalOpen =
    window.open;

  window.open =
    function (
      url,
      ...args
    ) {
      announce(url);

      return originalOpen.call(
        window,
        url,
        ...args
      );
    };

  const originalFetch =
    window.fetch;

  window.fetch =
    function (
      input,
      init
    ) {
      announce(
        typeof input ===
          "string"
          ? input
          : input?.url
      );

      return originalFetch.call(
        this,
        input,
        init
      );
    };

  const originalXhrOpen =
    XMLHttpRequest
      .prototype
      .open;

  XMLHttpRequest
    .prototype
    .open =
    function (
      method,
      url,
      ...args
    ) {
      announce(url);

      return originalXhrOpen.call(
        this,
        method,
        url,
        ...args
      );
    };

  document.addEventListener(
    "click",
    (event) => {
      const target =
        event.target instanceof
        Element
          ? event.target.closest(
              "a[href]"
            )
          : null;

      if (target) {
        announce(
          target.href
        );
      }
    },
    true
  );
})();