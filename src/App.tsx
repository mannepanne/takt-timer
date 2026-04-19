// ABOUT: Top-level application component.
// ABOUT: Wraps routes in the PhoneFrame (centred mobile viewport on desktop).

import { Route, Routes } from 'react-router-dom';

import { PhoneFrame } from '@/components/PhoneFrame';
import { Home } from '@/routes/Home';
import { NotFound } from '@/routes/NotFound';
import { Privacy } from '@/routes/Privacy';

export function App() {
  return (
    <PhoneFrame>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </PhoneFrame>
  );
}
