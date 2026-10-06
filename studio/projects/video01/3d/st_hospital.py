import sys
sys.argv = [sys.argv[0], "hospital"] + sys.argv[1:]
exec(open("story.py").read())
