import React from 'react';
import { Text } from 'react-native';
import { Screen, Card } from '../components/native.jsx';
import { type } from '../theme.js';

export default function Visit() {
  return (
    <Screen title="Visit us">
      <Card><Text style={type.heading}>Opening hours</Text><Text style={type.body}>Sample hours: 7 am to 6 pm, every day.</Text></Card>
    </Screen>
  );
}
