import React, { useState } from 'react';
import { Text } from 'react-native';
import { Screen, Card, Field, Button, ListRow } from '../components/native.jsx';
import { type } from '../theme.js';

export default function Order({ cart, onClear }) {
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const total = cart.reduce((s, i) => s + i.price, 0);
  if (sent) return <Screen title="Order sent"><Card><Text style={type.body}>Thanks, {name}. We will call your name at the counter.</Text></Card><Button title="New order" onPress={() => { setSent(false); onClear(); }} /></Screen>;
  return (
    <Screen title="Your order">
      {cart.length ? <Card style={{ padding: 0 }}>{cart.map((i, n) => <ListRow key={n} title={i.name} right={'$' + i.price.toFixed(2)} />)}</Card> : <Card><Text style={type.body}>Nothing yet. Add drinks from the Menu tab.</Text></Card>}
      <Field label="Name for the order" value={name} onChangeText={setName} placeholder="Your first name" />
      <Button title={'Send order' + (total ? ' ($' + total.toFixed(2) + ')' : '')} disabled={!cart.length || !name.trim()} onPress={() => setSent(true)} />
    </Screen>
  );
}
