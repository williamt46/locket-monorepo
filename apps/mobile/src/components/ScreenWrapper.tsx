import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface ScreenWrapperProps {
    children: React.ReactNode;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children }) => {
    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.content}>
                {children}
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.paper,
    },
    content: {
        flex: 1,
    },
});
