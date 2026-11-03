/** Jeu d'essai de la règle des numéros (observation de recette 1) ; l'interface rejoue les mêmes cas (test de cohérence). */
export const VALID_PHONES: readonly (readonly [string, string])[] = [
  ['+237 699 12 34 56', '+237699123456'],
  ['+225 0701234567', '+2250701234567'],
  ['+33 6 12 34 56 78', '+33612345678'],
  ['237699123456', '237699123456'],
  ['  +237   699 12 34 56  ', '+237699123456'],
  ['+237 699 12 34 56', '+237699123456'],
  ['12345678', '12345678'],
  ['+123456789012345', '+123456789012345'],
];
export const INVALID_PHONES: readonly (readonly [string, RegExp])[] = [
  ['0699123456', /ne doit pas commencer par 0/],
  ['+0699123456', /ne doit pas commencer par 0/],
  ['++237699123456', /« \+ » n'est accepté qu'au début/],
  ['237+699123456', /« \+ » n'est accepté qu'au début/],
  ['+237-699123456', /que des chiffres, des espaces/],
  ['+237(699)123456', /que des chiffres, des espaces/],
  ['+237.699.123456', /que des chiffres, des espaces/],
  ['abc', /que des chiffres, des espaces/],
  ['+237 699 12 34 56 78 90 12', /dépasser 15 chiffres/],
  ['+1234567890123456', /dépasser 15 chiffres/],
  ['69912', /trop court \(8 chiffres au moins\)/],
  ['+1234567', /trop court/],
  ['+', /trop court/],
  ['+ ', /trop court/],
];

