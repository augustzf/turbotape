dofile("init_uart.lua")
print("** Setting speed to 115200. Remember to reconnect! **")
tmr.delay(1000000)
uart.setup(0, 115200, 8, 0, 1, 1)
