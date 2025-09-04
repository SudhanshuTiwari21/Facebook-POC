import * as AuthSession from "expo-auth-session";
import React, { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

const FB_DISCOVERY = {
  authorizationEndpoint: "https://www.facebook.com/v20.0/dialog/oauth",
  tokenEndpoint: "https://graph.facebook.com/v20.0/oauth/access_token",
};

export default function Index() {
    useEffect(() => {
    const redirect = AuthSession.makeRedirectUri({
      useProxy: true,  
     } as any);
    console.log("Redirect URI:", redirect);
  }, []);
  console.log("HELLO FROM INDEX");
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<{ value: string; expiry: string } | null>(
    null
  );

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: "2097788607397206", 
      scopes: ["public_profile", "email"],
      redirectUri: AuthSession.makeRedirectUri({ useProxy: true } as any),
    },
    FB_DISCOVERY
  );

  useEffect(() => {
    console.log("Redirect URI:", AuthSession.makeRedirectUri({ useProxy: true } as any));

    if (response?.type === "success") {
      const { access_token, expires_in } = response.params;
      setToken({ value: access_token, expiry: expires_in });
      fetch(
        `https://graph.facebook.com/me?fields=id,name,email&access_token=${access_token}`
      )
        .then((res) => res.json())
        .then((data) => setUser(data));
    } else if (response?.type === "error") {
      alert("Login error: " + response.error?.description);
    } else if (response?.type === "dismiss") {
      alert("Login cancelled");
    }
  }, [response]);

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <View style={styles.container}>
      {!user ? (
        <Button
          disabled={!request}
          title="Continue with Facebook"
          onPress={() => promptAsync({ useProxy: true } as any)}
        />
      ) : (
        <View>
          <Text>Token: ****{token?.value.slice(-8)}</Text>
          <Text>Expires in: {token?.expiry} sec</Text>
          <Text>User Info: {JSON.stringify(user, null, 2)}</Text>
          <Button title="Logout" onPress={logout} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
});
