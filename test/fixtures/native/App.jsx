// Sample native app (test fixture): a café's ordering app with three tabs.
import React, { useState } from 'react';
import { View } from 'react-native';
import { TabBar } from './components/native.jsx';
import Menu from './screens/Menu.jsx';
import Order from './screens/Order.jsx';
import Visit from './screens/Visit.jsx';

const TABS = [{ key: 'menu', label: 'Menu' }, { key: 'order', label: 'Order' }, { key: 'visit', label: 'Visit' }];

export default function App() {
  const [tab, setTab] = useState('menu');
  const [cart, setCart] = useState([]);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'menu' && <Menu onAdd={(item) => setCart([...cart, item])} count={cart.length} />}
        {tab === 'order' && <Order cart={cart} onClear={() => setCart([])} />}
        {tab === 'visit' && <Visit />}
      </View>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
    </View>
  );
}
