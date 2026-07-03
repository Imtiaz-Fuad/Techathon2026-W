const ROOMS = [
  {
    name: "Drawing Room",
    code: "DR",
    fans: 2,
    lights: 3,
  },
  {
    name: "Work Room 1",
    code: "WR1",
    fans: 2,
    lights: 3,
  },
  {
    name: "Work Room 2",
    code: "WR2",
    fans: 2,
    lights: 3,
  },
];

const DEVICE_LAYOUT = ROOMS.flatMap((room) => [
  ...Array.from({ length: room.fans }, (_, index) => ({
    id: `${room.code}_F${index + 1}`,
    room: room.name,
    type: "Fan",
    name: `Fan ${index + 1}`,
    power_draw: 60,
  })),
  ...Array.from({ length: room.lights }, (_, index) => ({
    id: `${room.code}_L${index + 1}`,
    room: room.name,
    type: "Light",
    name: `Light ${index + 1}`,
    power_draw: 15,
  })),
]);

module.exports = {
  DEVICE_LAYOUT,
  ROOMS,
};

