import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthScreen } from '../screens/AuthScreen';
import { LedgerScreen } from '../screens/LedgerScreen';
import { colors } from '../theme/colors';

const Stack = createStackNavigator();

export const AppNavigator = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    cardStyle: { backgroundColor: colors.paper }
                }}
            >
                <Stack.Screen name="Auth" component={AuthScreen} />
                <Stack.Screen name="Ledger" component={LedgerScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};
