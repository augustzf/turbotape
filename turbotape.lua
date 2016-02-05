function turbotape(f)
  local b,n="",0
  file.open(f,"w")
  uart.on("data", "\n", function(d)
    local l=string.len(d)
    if n+l > 1024 then
      file.write(b)
      file.flush()
      b,n="",0
    end
    if string.sub(d,0,3)~="EOF" then
      b=b..d
      n=n+l
    else
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
