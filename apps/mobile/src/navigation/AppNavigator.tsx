import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthScreen } from '../screens/AuthScreen';
import { LedgerScreen } from '../screens/LedgerScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ConsentScreen } from '../screens/ConsentScreen';
import { ImportScreen } from '../screens/ImportScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { LogScreen } from '../screens/LogScreen';
import { CycleInsightsScreen } from '../screens/CycleInsightsScreen';
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
                <Stack.Screen name="Import" component={ImportScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Consent" component={ConsentScreen} />
                <Stack.Screen name="Log" component={LogScreen} />
                <Stack.Screen name="CycleInsights" component={CycleInsightsScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};
