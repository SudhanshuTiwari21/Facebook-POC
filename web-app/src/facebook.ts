export type FacebookUser = {
  id: string;
  name?: string;
  email?: string;
};

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

const FB_SDK_SCRIPT_ID = "facebook-jssdk";

export function loadFacebookSdk(appId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));

  if (window.FB) {
    window.FB.init({
      appId,
      cookie: true,
      xfbml: false,
      version: "v20.0",
    });
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      try {
        window.FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version: "v20.0",
        });
        resolve();
      } catch (e) {
        reject(e);
      }
    };

    const existing = document.getElementById(FB_SDK_SCRIPT_ID);

    if (!existing) {
      // Avoid adding the script multiple times (HMR/dev reloads).
      const script = document.createElement("script");
      script.id = FB_SDK_SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.onerror = () =>
        reject(new Error("Failed to load Facebook SDK from connect.facebook.net"));
      document.body.appendChild(script);
    }

    // If the SDK script is already loaded, fbAsyncInit might have fired before
    // this call. Poll for `window.FB` briefly to keep the promise from hanging.
    const startedAt = Date.now();
    const poll = window.setInterval(() => {
      if (window.FB) {
        try {
          window.FB.init({
            appId,
            cookie: true,
            xfbml: false,
            version: "v20.0",
          });
          window.clearInterval(poll);
          resolve();
        } catch (e) {
          window.clearInterval(poll);
          reject(e);
        }
        return;
      }

      if (Date.now() - startedAt > 10_000) {
        window.clearInterval(poll);
        reject(new Error("Timed out waiting for Facebook SDK"));
      }
    }, 150);
  });
}

export function getFacebookAccessToken(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!window.FB?.getLoginStatus) return resolve(null);
    window.FB.getLoginStatus((res: any) => {
      resolve(res?.authResponse?.accessToken ?? null);
    });
  });
}

export function loginWithFacebook(configId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.FB?.login) return reject(new Error("Facebook SDK not ready"));
    if (!configId) {
      return reject(
        new Error("Missing VITE_FB_CONFIG_ID (Facebook Login for Business configuration)")
      );
    }

    // Permissions come from the Business Login configuration in Meta dashboard.
    window.FB.login(
      (res: any) => {
        const token = res?.authResponse?.accessToken;
        if (!token) {
          reject(
            new Error(
              res?.status
                ? `Facebook login failed: ${res.status}`
                : "Facebook login cancelled"
            )
          );
          return;
        }
        resolve(token);
      },
      { config_id: configId }
    );
  });
}

export function logoutFromFacebook(): Promise<void> {
  return new Promise((resolve) => {
    if (!window.FB?.logout) return resolve();
    window.FB.logout(() => resolve());
  });
}

