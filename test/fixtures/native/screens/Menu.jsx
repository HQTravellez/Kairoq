import React from 'react';
import { Text } from 'react-native';
import { Screen, ListRow, Card } from '../components/native.jsx';
import { MENU } from '../data/menu.js';
import { type, colors } from '../theme.js';

export default function Menu({ onAdd, count }) {
  return (
    <Screen title="Menu" subtitle={count ? count + ' in your order' : 'Tap a drink to add it'}>
      <Card style={{ padding: 0 }}>
        {MENU.map((m) => (
          <ListRow key={m.id} title={m.name} subtitle={m.note} right={'$' + m.price.toFixed(2)} onPress={() => onAdd(m)} />
        ))}
      </Card>
      <Text style={[type.small, { color: colors.subtle }]}>Sample menu and prices.</Text>
    </Screen>
  );
}
