function turbotape(f, len)
  local CHUNK_SIZE = 40
  local received = 0
  local b,n="",0
  file.open(f,"w")
  uart.on("data", CHUNK_SIZE, function(d)
    --local l=string.len(d)
    received = received + CHUNK_SIZE
    if n+CHUNK_SIZE > 1024 then
      file.write(b)
      file.flush()
      b,n="",0
    end
    if received < len then
      b=b..d
      n=n+CHUNK_SIZE
    else
      local remainder = len % CHUNK_SIZE
      if remainder > 0 then
        b=b:sub(1,-(remainder+1))
      end
      file.write(b)
      file.flush()
      file.close()
      file.open(f, "r")
      print(crypto.toHex(crypto.hash("sha1",file.read())))
      file.close()
      uart.on("data")
    end
  end, 0)
  print("READY")
end
print("Turbotape is ready!")
