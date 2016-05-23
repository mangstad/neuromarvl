import sys

# Reverse the winding order of the faces in the specified OBJ file
fileName = sys.argv[1]

inFile = open(fileName, 'r')
outFile = open(fileName + '-fix', 'w')

for line in inFile:
  if line[0] == 'f':
    parts = line.split()
    outFile.write(parts[0] + ' ' + parts[1] + ' ' + parts[3] + ' ' + parts[2] + '\n')
  else:
    outFile.write(line)