import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthScreen } from '../screens/AuthScreen';
import { LedgerScreen } from '../screens/LedgerScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { getUserConfig } from '../services/StorageService';
import { colors } from '../theme/colors';

const Stack = createStackNavigator();

export const AppNavigator = () => {
    const [initialRoute, setInitialRoute] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const config = await getUserConfig();
            // If no config exists → user hasn't completed onboarding
            setInitialRoute(config ? 'Auth' : 'Onboarding');
        })();
    }, []);

    // Don't render navigation until we've determined the initial route
    if (!initialRoute) return null;

    return (
        <NavigationContainer>
            <Stack.Navigator
                id="RootStack"
                initialRouteName={initialRoute}
                screenOptions={{
                    headerShown: false,
                    cardStyle: { backgroundColor: colors.paper }
                }}
            >
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                <Stack.Screen name="Auth" component={AuthScreen} />
                <Stack.Screen name="Ledger" component={LedgerScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};
